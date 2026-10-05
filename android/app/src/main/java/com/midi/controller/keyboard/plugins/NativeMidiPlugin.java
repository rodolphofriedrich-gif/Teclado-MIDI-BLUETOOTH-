package com.midi.controller.keyboard.plugins;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.midi.MidiDevice;
import android.media.midi.MidiDeviceInfo;
import android.media.midi.MidiDeviceStatus;
import android.media.midi.MidiInputPort;
import android.media.midi.MidiManager;
import android.media.midi.MidiOutputPort;
import android.media.midi.MidiReceiver;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "NativeMidi",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_ADVERTISE
            }
        ),
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION
            }
        )
    }
)
public class NativeMidiPlugin extends Plugin {

    // =========================================================
    // BLE MIDI PADRÃO
    // =========================================================
    private static final UUID BLE_MIDI_SERVICE_UUID =
        UUID.fromString("03b80e5a-ede8-4b33-a020-514f0634123b");

    private static final UUID BLE_MIDI_CHARACTERISTIC_UUID =
        UUID.fromString("7772e5db-3868-4112-a1a9-f2669d106bf3");

    private static final UUID CLIENT_CONFIGURATION_DESCRIPTOR_UUID =
        UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    // =========================================================
    // VARIÁVEIS DO MIDI NATIVO E BLUETOOTH
    // =========================================================
    private MidiManager midiManager;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner bleScanner;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService deviceCallbackExecutor = Executors.newSingleThreadExecutor();
    private MidiManager.DeviceCallback deviceCallback;
    private boolean deviceCallbackRegistered = false;

    private MidiDevice connectedDevice;
    private MidiInputPort connectedInputPort;
    private MidiOutputPort connectedOutputPort;
    private MidiReceiver connectedReceiver;
    private int connectedDeviceId = -1;

    private final Map<String, BluetoothDevice> scannedBluetoothDevices = new HashMap<>();

    // =========================================================
    // VARIÁVEIS DO SERVIDOR BLE MIDI
    // =========================================================
    private BluetoothGattServer bleGattServer;
    private BluetoothGattService bleMidiService;
    private BluetoothGattCharacteristic bleMidiCharacteristic;
    private final Set<BluetoothDevice> bleClients = new HashSet<>();
    private final Set<String> bleNotificationClients = new HashSet<>();
    private BluetoothLeAdvertiser bluetoothLeAdvertiser;
    private AdvertiseCallback advertiseCallback;
    private boolean bleMidiServerRunning = false;
    
    // GUARDA A CHAMADA PARA RETORNAR O ERRO OU SUCESSO REAL
    private PluginCall pendingServerCall;

    @Override
    public void load() {
        midiManager = (MidiManager) getContext().getSystemService(Activity.MIDI_SERVICE);
        BluetoothManager bluetoothManager = (BluetoothManager) getContext().getSystemService(Activity.BLUETOOTH_SERVICE);
        if (bluetoothManager != null) {
            bluetoothAdapter = bluetoothManager.getAdapter();
        }
        registerMidiDeviceCallback();
    }

    @PluginMethod
    public void fecharApp(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Não foi possível obter a Activity principal.");
            return;
        }
        call.resolve();
        activity.runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                activity.finishAndRemoveTask();
            } else {
                activity.finishAffinity();
            }
        });
    }

    private void registerMidiDeviceCallback() {
        if (midiManager == null || deviceCallbackRegistered) return;
        deviceCallback = new MidiManager.DeviceCallback() {
            @Override
            public void onDeviceAdded(MidiDeviceInfo device) { notifyDevicesChanged(); }
            @Override
            public void onDeviceRemoved(MidiDeviceInfo device) {
                if (connectedDeviceId == device.getId()) closeConnectedDevice();
                notifyDevicesChanged();
            }
            @Override
            public void onDeviceStatusChanged(MidiDeviceStatus status) { notifyDevicesChanged(); }
        };
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            midiManager.registerDeviceCallback(MidiManager.TRANSPORT_MIDI_BYTE_STREAM, deviceCallbackExecutor, deviceCallback);
        } else {
            midiManager.registerDeviceCallback(deviceCallback, new Handler(Looper.getMainLooper()));
        }
        deviceCallbackRegistered = true;
    }

    private void notifyDevicesChanged() {
        notifyListeners("devicesChanged", new JSObject());
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        if (midiManager == null) {
            call.reject("O serviço MIDI do Android não está disponível neste aparelho.");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void isBluetoothEnabled(PluginCall call) {
        try {
            boolean enabled = bluetoothAdapter != null && bluetoothAdapter.isEnabled();
            JSObject result = new JSObject();
            result.put("enabled", enabled);
            call.resolve(result);
        } catch (SecurityException e) {
            call.reject("Permissão Bluetooth não concedida.", e);
        }
    }

    @PluginMethod
    public void requestEnableBluetooth(PluginCall call) {
        if (bluetoothAdapter == null) {
            call.reject("Bluetooth não está disponível neste aparelho.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasBluetoothConnectPermission()) {
            requestPermissionForAlias("bluetooth", call, "bluetoothPermissionForEnableResult");
            return;
        }
        launchBluetoothEnableIntent(call);
    }

    @PermissionCallback
    private void bluetoothPermissionForEnableResult(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Permissão Bluetooth negada.");
            return;
        }
        launchBluetoothEnableIntent(call);
    }

    private void launchBluetoothEnableIntent(PluginCall call) {
        try {
            if (bluetoothAdapter.isEnabled()) {
                JSObject result = new JSObject();
                result.put("enabled", true);
                call.resolve(result);
                return;
            }
        } catch (SecurityException e) {
            call.reject("Permissão Bluetooth não concedida.", e);
            return;
        }
        Intent intent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
        startActivityForResult(call, intent, "bluetoothEnableResult");
    }

    @ActivityCallback
    private void bluetoothEnableResult(PluginCall call, ActivityResult result) {
        boolean enabled = false;
        try {
            enabled = bluetoothAdapter != null && bluetoothAdapter.isEnabled();
        } catch (SecurityException ignored) { }
        JSObject response = new JSObject();
        response.put("enabled", enabled);
        call.resolve(response);
    }

    @PluginMethod
    public void getDevices(PluginCall call) {
        if (midiManager == null) {
            call.reject("MidiManager não disponível.");
            return;
        }
        try {
            Set<MidiDeviceInfo> devices = getByteStreamDevices();
            JSArray array = new JSArray();
            for (MidiDeviceInfo info : devices) {
                if (info.getInputPortCount() <= 0) continue;
                JSObject item = new JSObject();
                item.put("id", info.getId());
                item.put("name", getDeviceName(info));
                item.put("manufacturer", getDeviceManufacturer(info));
                item.put("type", mapDeviceType(info.getType()));
                item.put("inputPortCount", info.getInputPortCount());
                item.put("outputPortCount", info.getOutputPortCount());
                array.put(item);
            }
            JSObject result = new JSObject();
            result.put("devices", array);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Não foi possível consultar os dispositivos MIDI.", e);
        }
    }

    private Set<MidiDeviceInfo> getByteStreamDevices() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return midiManager.getDevicesForTransport(MidiManager.TRANSPORT_MIDI_BYTE_STREAM);
        }
        Set<MidiDeviceInfo> devices = new HashSet<>();
        for (MidiDeviceInfo info : midiManager.getDevices()) devices.add(info);
        return devices;
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String idString = call.getString("id");
        int port = call.getInt("port", 0);
        if (idString == null) {
            call.reject("ID do dispositivo MIDI não informado.");
            return;
        }
        try {
            int deviceId = Integer.parseInt(idString);
            MidiDeviceInfo target = findDevice(deviceId);
            if (target == null) {
                call.reject("Dispositivo MIDI não encontrado. Atualize a lista.");
                return;
            }
            openMidiDevice(target, port, call);
        } catch (NumberFormatException e) {
            call.reject("ID MIDI inválido.");
        }
    }

    @PluginMethod
    public void connectBluetooth(PluginCall call) {
        String address = call.getString("address");
        int port = call.getInt("port", 0);
        if (address == null || address.trim().isEmpty()) {
            call.reject("Endereço Bluetooth não informado.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasBluetoothConnectPermission()) {
            requestPermissionForAlias("bluetooth", call, "bluetoothPermissionForConnectResult");
            return;
        }
        openBluetoothDevice(address, port, call);
    }

    @PermissionCallback
    private void bluetoothPermissionForConnectResult(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Permissão Bluetooth negada.");
            return;
        }
        String address = call.getString("address");
        int port = call.getInt("port", 0);
        if (address == null) {
            call.reject("Endereço Bluetooth não informado.");
            return;
        }
        openBluetoothDevice(address, port, call);
    }

    private void openBluetoothDevice(String address, int port, PluginCall call) {
        if (bluetoothAdapter == null || midiManager == null) {
            call.reject("Bluetooth MIDI não está disponível.");
            return;
        }
        try {
            BluetoothDevice device = scannedBluetoothDevices.get(address);
            if (device == null) device = bluetoothAdapter.getRemoteDevice(address);
            final BluetoothDevice target = device;
            midiManager.openBluetoothDevice(target, midiDevice -> {
                if (midiDevice == null) {
                    call.reject("O Android não conseguiu abrir o canal BLE MIDI com este dispositivo.");
                    return;
                }
                openPortsAndResolve(midiDevice, port, call);
            }, mainHandler);
        } catch (IllegalArgumentException e) {
            call.reject("Endereço Bluetooth inválido.", e);
        } catch (SecurityException e) {
            call.reject("Permissão Bluetooth não concedida.", e);
        }
    }

    private void openMidiDevice(MidiDeviceInfo target, int port, PluginCall call) {
        midiManager.openDevice(target, midiDevice -> {
            if (midiDevice == null) {
                call.reject("O Android não conseguiu abrir o dispositivo MIDI.");
                return;
            }
            openPortsAndResolve(midiDevice, port, call);
        }, mainHandler);
    }

    private void openPortsAndResolve(MidiDevice device, int port, PluginCall call) {
        try {
            closeConnectedDevice();
            if (port < 0 || port >= device.getInfo().getInputPortCount()) {
                device.close();
                call.reject("Porta MIDI inválida: " + port);
                return;
            }
            connectedDevice = device;
            connectedDeviceId = device.getInfo().getId();
            connectedInputPort = device.openInputPort(port);
            if (connectedInputPort == null) {
                for (int i = 0; i < device.getInfo().getInputPortCount(); i++) {
                    if (i != port) {
                        connectedInputPort = device.openInputPort(i);
                        if (connectedInputPort != null) break;
                    }
                }
            }
            if (connectedInputPort == null) {
                closeConnectedDevice();
                call.reject("A porta MIDI está ocupada por outra aplicação.");
                return;
            }
            if (device.getInfo().getOutputPortCount() > 0) {
                connectedOutputPort = device.openOutputPort(0);
                if (connectedOutputPort != null) {
                    connectedReceiver = new MidiReceiver() {
                        @Override
                        public void onSend(byte[] msg, int offset, int count, long timestamp) throws IOException {
                            byte[] copy = new byte[count];
                            System.arraycopy(msg, offset, copy, 0, count);
                            JSObject event = new JSObject();
                            event.put("data", toJSArray(copy));
                            event.put("timestamp", timestamp);
                            notifyListeners("midiMessage", event);
                        }
                    };
                    connectedOutputPort.connect(connectedReceiver);
                }
            }
            JSObject result = new JSObject();
            result.put("id", String.valueOf(connectedDeviceId));
            result.put("name", getDeviceName(device.getInfo()));
            call.resolve(result);
            notifyDevicesChanged();
        } catch (Exception e) {
            closeConnectedDevice();
            call.reject("Falha ao abrir o dispositivo MIDI: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void send(PluginCall call) {
        JSArray dataArray = call.getArray("data");
        if (dataArray == null) {
            call.reject("Nenhum dado MIDI foi informado.");
            return;
        }
        try {
            List<Object> values = dataArray.toList();
            byte[] data = new byte[values.size()];
            for (int i = 0; i < values.size(); i++) {
                int number = ((Number) values.get(i)).intValue();
                if (number < 0 || number > 255) throw new IllegalArgumentException("Byte MIDI fora da faixa: " + number);
                data[i] = (byte) number;
            }

            boolean sent = false;
            if (connectedInputPort != null) {
                connectedInputPort.send(data, 0, data.length);
                sent = true;
            }
            if (!bleClients.isEmpty()) {
                sendBleMidiToClients(data);
                sent = true;
            }
            if (!sent) {
                call.reject("Nenhum destino MIDI conectado.");
                return;
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Falha ao enviar MIDI: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeConnectedDevice();
        call.resolve();
        notifyDevicesChanged();
    }

    @PluginMethod
    public void scanBluetoothMidi(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!hasBluetoothScanPermission() || !hasBluetoothConnectPermission()) {
                requestPermissionForAlias("bluetooth", call, "bluetoothPermissionForScanResult");
                return;
            }
        } else if (!hasLocationPermission()) {
            requestPermissionForAlias("location", call, "locationPermissionForScanResult");
            return;
        }
        startBleMidiScan(call);
    }

    @PermissionCallback
    private void bluetoothPermissionForScanResult(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Permissão Bluetooth negada.");
            return;
        }
        startBleMidiScan(call);
    }

    @PermissionCallback
    private void locationPermissionForScanResult(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Permissão de localização necessária para a busca BLE neste Android.");
            return;
        }
        startBleMidiScan(call);
    }

    private void startBleMidiScan(final PluginCall call) {
        if (bluetoothAdapter == null) {
            call.reject("Bluetooth não está disponível neste aparelho.");
            return;
        }
        try {
            if (!bluetoothAdapter.isEnabled()) {
                call.reject("O Bluetooth está desligado.");
                return;
            }
            bleScanner = bluetoothAdapter.getBluetoothLeScanner();
            if (bleScanner == null) {
                call.reject("O scanner BLE não está disponível.");
                return;
            }

            final List<JSObject> found = new ArrayList<>();
            final Set<String> addresses = new HashSet<>();
            List<ScanFilter> filters = new ArrayList<>();
            ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build();

            final ScanCallback callback = new ScanCallback() {
                @Override
                public void onScanResult(int callbackType, ScanResult result) {
                    BluetoothDevice device = result.getDevice();
                    String address = device.getAddress();
                    if (address == null || addresses.contains(address)) return;
                    String name = safeDeviceName(device);
                    if (name != null) {
                        String lowerName = name.toLowerCase();
                        if (lowerName.equals("mi band") || lowerName.contains("galaxy buds")) return;
                    }
                    addresses.add(address);
                    scannedBluetoothDevices.put(address, device);
                    JSObject item = new JSObject();
                    item.put("address", address);
                    item.put("name", name);
                    found.add(item);
                }
                @Override
                public void onScanFailed(int errorCode) {
                    stopScanSafely(this);
                    call.reject("Falha na busca BLE. Código: " + errorCode);
                }
            };
            bleScanner.startScan(filters, settings, callback);
            long requestedDuration = call.getInt("durationMs", 15000);
            final long duration = Math.max(1000, Math.min(requestedDuration, 30000));
            mainHandler.postDelayed(() -> {
                stopScanSafely(callback);
                JSArray resultArray = new JSArray();
                for (JSObject item : found) resultArray.put(item);
                JSObject result = new JSObject();
                result.put("devices", resultArray);
                call.resolve(result);
            }, duration);
        } catch (SecurityException e) {
            call.reject("Permissão Bluetooth não concedida.", e);
        } catch (Exception e) {
            call.reject("Não foi possível iniciar a busca BLE MIDI.", e);
        }
    }

    private void stopScanSafely(ScanCallback callback) {
        if (bleScanner == null) return;
        try {
            if (hasBluetoothScanPermission()) bleScanner.stopScan(callback);
        } catch (Exception ignored) { }
    }


    // =========================================================
    // INICIAR SERVIDOR BLE MANUALMENTE (VISIBILIDADE ANDROID)
    // =========================================================
    @PluginMethod
    public void startBleServer(PluginCall call) {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth não está ativado.");
            return;
        }

        if (bluetoothAdapter.getBluetoothLeAdvertiser() == null) {
            call.reject("O hardware deste celular não suporta o Modo Periférico BLE (Emitir sinal).");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!hasBluetoothConnectPermission() || !hasBluetoothAdvertisePermission()) {
                this.pendingServerCall = call;
                requestPermissionForAlias("bluetooth", call, "bluetoothPermissionForServer");
                return;
            }
        }

        // SALVA A CHAMADA PARA RETORNAR APENAS DEPOIS DO SUCESSO REAL
        this.pendingServerCall = call;
        stopBleMidiServer();
        startBleMidiServerSafely();
    }

    @PermissionCallback
    private void bluetoothPermissionForServer(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Permissão Bluetooth negada.");
            this.pendingServerCall = null;
            return;
        }
        stopBleMidiServer();
        startBleMidiServerSafely();
    }


    private void startBleMidiServerSafely() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return;
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) return;
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!hasBluetoothConnectPermission() || !hasBluetoothAdvertisePermission()) return;
            }

            if (bleMidiServerRunning) {
                if (pendingServerCall != null) {
                    pendingServerCall.resolve();
                    pendingServerCall = null;
                }
                return;
            }

            BluetoothManager bluetoothManager = (BluetoothManager) getContext().getSystemService(Activity.BLUETOOTH_SERVICE);
            if (bluetoothManager == null) return;
            
            bleGattServer = bluetoothManager.openGattServer(getContext(), bleGattServerCallback);
            if (bleGattServer == null) return;

            bleMidiService = new BluetoothGattService(BLE_MIDI_SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY);

            // CORREÇÃO: Adicionado permissão de READ, exigido por alguns scanners
            bleMidiCharacteristic = new BluetoothGattCharacteristic(
                BLE_MIDI_CHARACTERISTIC_UUID,
                BluetoothGattCharacteristic.PROPERTY_READ
                    | BluetoothGattCharacteristic.PROPERTY_WRITE
                    | BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE
                    | BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                BluetoothGattCharacteristic.PERMISSION_READ
                    | BluetoothGattCharacteristic.PERMISSION_WRITE
            );

            BluetoothGattDescriptor descriptor = new BluetoothGattDescriptor(
                CLIENT_CONFIGURATION_DESCRIPTOR_UUID,
                BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE
            );
            bleMidiCharacteristic.addDescriptor(descriptor);
            bleMidiService.addCharacteristic(bleMidiCharacteristic);

            boolean added = bleGattServer.addService(bleMidiService);
            if (!added) {
                stopBleMidiServer();
                if (pendingServerCall != null) {
                    pendingServerCall.reject("Falha ao criar o serviço GATT.");
                    pendingServerCall = null;
                }
                return;
            }

            mainHandler.postDelayed(this::startBleMidiAdvertising, 300);
            bleMidiServerRunning = true;

        } catch (SecurityException | Exception e) {
            stopBleMidiServer();
            if (pendingServerCall != null) {
                pendingServerCall.reject("Erro crítico: " + e.getMessage());
                pendingServerCall = null;
            }
        }
    }

    private final BluetoothGattServerCallback bleGattServerCallback = new BluetoothGattServerCallback() {
        @Override
        public void onServiceAdded(int status, BluetoothGattService service) { }

        @Override
        public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            if (device == null) return;
            String address = safeBluetoothAddress(device);
            
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                bleClients.add(device);
                notifyDevicesChanged();
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                bleClients.remove(device);
                bleNotificationClients.remove(address);
                notifyDevicesChanged();
            }
        }

        // CORREÇÃO: Responde a pedidos de leitura do Tablet para não travar a conexão
        @Override
        public void onCharacteristicReadRequest(BluetoothDevice device, int requestId, int offset, BluetoothGattCharacteristic characteristic) {
            if (bleGattServer != null) {
                try {
                    bleGattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, new byte[0]);
                } catch (Exception ignored) {}
            }
        }

        @Override
        public void onDescriptorWriteRequest(BluetoothDevice device, int requestId, BluetoothGattDescriptor descriptor, boolean preparedWrite, boolean responseNeeded, int offset, byte[] value) {
            if (descriptor == null) return;
            if (CLIENT_CONFIGURATION_DESCRIPTOR_UUID.equals(descriptor.getUuid())) {
                String address = safeBluetoothAddress(device);
                if (value != null && value.length >= 2 && value[0] == BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE[0]) {
                    bleNotificationClients.add(address);
                } else {
                    bleNotificationClients.remove(address);
                }
            }
            if (responseNeeded && bleGattServer != null) {
                try { bleGattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null); } catch (Exception ignored) {}
            }
        }

        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId, BluetoothGattCharacteristic characteristic, boolean preparedWrite, boolean responseNeeded, int offset, byte[] value) {
            if (characteristic == null) return;
            if (BLE_MIDI_CHARACTERISTIC_UUID.equals(characteristic.getUuid())) {
                if (value != null && value.length > 0) processIncomingBleMidi(value);
            }
            if (responseNeeded && bleGattServer != null) {
                try { bleGattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null); } catch (Exception ignored) {}
            }
        }
    };


    private void startBleMidiAdvertising() {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasBluetoothAdvertisePermission()) return;
            bluetoothLeAdvertiser = bluetoothAdapter.getBluetoothLeAdvertiser();
            if (bluetoothLeAdvertiser == null) return;

            if (advertiseCallback != null) {
                try { bluetoothLeAdvertiser.stopAdvertising(advertiseCallback); } catch (Exception ignored) {}
            }

            AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(true)
                .setTimeout(0)
                .build();

            // CORREÇÃO MAXIMA (LIMITE DE 31 BYTES)
            // Apenas o UUID do serviço garante não estourar o limite.
            AdvertiseData advertiseData = new AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .setIncludeTxPowerLevel(false)
                .addServiceUuid(new ParcelUuid(BLE_MIDI_SERVICE_UUID))
                .build();

            // O nome agora vai no pacote secundário usando o nome real do celular, garantindo visibilidade no tablet!
            AdvertiseData scanResponse = new AdvertiseData.Builder()
                .setIncludeDeviceName(true)
                .build();

            advertiseCallback = new AdvertiseCallback() {
                @Override
                public void onStartSuccess(AdvertiseSettings settingsInEffect) {
                    if (pendingServerCall != null) {
                        pendingServerCall.resolve();
                        pendingServerCall = null;
                    }
                }

                @Override
                public void onStartFailure(int errorCode) {
                    String msg = "Erro desconhecido (" + errorCode + ")";
                    if (errorCode == AdvertiseCallback.ADVERTISE_FAILED_DATA_TOO_LARGE) msg = "Nome do aparelho muito longo (Estourou limite de 31 bytes).";
                    else if (errorCode == AdvertiseCallback.ADVERTISE_FAILED_TOO_MANY_ADVERTISERS) msg = "Bluetooth sobrecarregado de conexões.";
                    else if (errorCode == AdvertiseCallback.ADVERTISE_FAILED_ALREADY_STARTED) {
                        if (pendingServerCall != null) {
                            pendingServerCall.resolve();
                            pendingServerCall = null;
                        }
                        return;
                    }
                    else if (errorCode == AdvertiseCallback.ADVERTISE_FAILED_INTERNAL_ERROR) msg = "Erro interno no sistema Android.";
                    else if (errorCode == AdvertiseCallback.ADVERTISE_FAILED_FEATURE_UNSUPPORTED) msg = "Hardware do celular incompatível.";

                    if (pendingServerCall != null) {
                        pendingServerCall.reject(msg);
                        pendingServerCall = null;
                    }
                }
            };

            bluetoothLeAdvertiser.startAdvertising(settings, advertiseData, scanResponse, advertiseCallback);
        } catch (Exception ignored) {}
    }


    private void sendBleMidiToClients(byte[] midiData) {
        if (bleGattServer == null || bleMidiCharacteristic == null || midiData == null || midiData.length == 0) return;
        byte[] packet = encodeBleMidiPacket(midiData);
        List<BluetoothDevice> clients = new ArrayList<>(bleClients);
        
        for (BluetoothDevice device : clients) {
            String address = safeBluetoothAddress(device);
            if (!bleNotificationClients.contains(address)) continue;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    bleGattServer.notifyCharacteristicChanged(device, bleMidiCharacteristic, false, packet);
                } else {
                    bleMidiCharacteristic.setValue(packet);
                    bleGattServer.notifyCharacteristicChanged(device, bleMidiCharacteristic, false);
                }
            } catch (Exception ignored) {}
        }
    }

    private byte[] encodeBleMidiPacket(byte[] midiData) {
        long now = System.currentTimeMillis();
        int timestamp = (int) (now & 0x1FFF);
        byte timestampHigh = (byte) (0x80 | ((timestamp >> 7) & 0x3F));
        byte timestampLow = (byte) (0x80 | (timestamp & 0x7F));
        byte[] packet = new byte[midiData.length + 2];
        packet[0] = timestampHigh;
        packet[1] = timestampLow;
        System.arraycopy(midiData, 0, packet, 2, midiData.length);
        return packet;
    }

    private void processIncomingBleMidi(byte[] packet) {
        if (packet == null || packet.length < 3) return;
        int index = 2;
        int runningStatus = -1;

        while (index < packet.length) {
            if (index < packet.length && (packet[index] & 0x80) == 0x80) {
                int status = packet[index] & 0xFF;
                if (status >= 0xF8) {
                    emitMidiMessage(new byte[] { (byte) status });
                    index++;
                    continue;
                }
                if (status >= 0x80) {
                    runningStatus = status;
                    int length = midiMessageLength(status);
                    if (length <= 0) {
                        if (status == 0xF0) {
                            ArrayList<Byte> sysex = new ArrayList<>();
                            sysex.add((byte) status);
                            index++;
                            while (index < packet.length) {
                                byte value = packet[index++];
                                sysex.add(value);
                                if ((value & 0xFF) == 0xF7) break;
                            }
                            byte[] message = new byte[sysex.size()];
                            for (int i = 0; i < sysex.size(); i++) message[i] = sysex.get(i);
                            emitMidiMessage(message);
                            continue;
                        }
                        emitMidiMessage(new byte[] { (byte) status });
                        index++;
                        continue;
                    }
                    if (index + length > packet.length) break;
                    byte[] message = new byte[length];
                    for (int i = 0; i < length; i++) message[i] = packet[index++];
                    emitMidiMessage(message);
                    continue;
                }
            }
            if (runningStatus >= 0 && index < packet.length && (packet[index] & 0x80) == 0) {
                int length = midiMessageLength(runningStatus);
                if (length <= 1) {
                    index++;
                    continue;
                }
                byte[] message = new byte[length];
                message[0] = (byte) runningStatus;
                int dataBytes = length - 1;
                if (index + dataBytes > packet.length) break;
                for (int i = 0; i < dataBytes; i++) message[i + 1] = packet[index++];
                emitMidiMessage(message);
                continue;
            }
            index++;
        }
    }

    private int midiMessageLength(int status) {
        status &= 0xFF;
        if (status >= 0x80 && status <= 0xEF) {
            int high = status & 0xF0;
            if (high == 0xC0 || high == 0xD0) return 2;
            return 3;
        }
        switch (status) {
            case 0xF1: case 0xF3: return 2;
            case 0xF2: return 3;
            case 0xF6: case 0xF8: case 0xF9: case 0xFA: case 0xFB: case 0xFC: case 0xFD: case 0xFE: case 0xFF: return 1;
            default: return 0;
        }
    }

    private void emitMidiMessage(byte[] data) {
        if (data == null || data.length == 0) return;
        JSObject event = new JSObject();
        event.put("data", toJSArray(data));
        event.put("timestamp", System.nanoTime());
        notifyListeners("midiMessage", event);
    }

    private void stopBleMidiServer() {
        try {
            if (bluetoothLeAdvertiser != null && advertiseCallback != null) {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || hasBluetoothAdvertisePermission()) {
                    bluetoothLeAdvertiser.stopAdvertising(advertiseCallback);
                }
            }
        } catch (Exception ignored) {}
        advertiseCallback = null;

        try {
            if (bleGattServer != null) {
                bleGattServer.clearServices();
                bleGattServer.close();
            }
        } catch (Exception ignored) {}
        bleGattServer = null;
        bleMidiService = null;
        bleMidiCharacteristic = null;
        bleClients.clear();
        bleNotificationClients.clear();
        bleMidiServerRunning = false;
    }

    private MidiDeviceInfo findDevice(int id) {
        for (MidiDeviceInfo info : getByteStreamDevices()) {
            if (info.getId() == id) return info;
        }
        return null;
    }

    private void closeConnectedDevice() {
        try { if (connectedOutputPort != null && connectedReceiver != null) connectedOutputPort.disconnect(connectedReceiver); } catch (Exception ignored) {}
        try { if (connectedOutputPort != null) connectedOutputPort.close(); } catch (Exception ignored) {}
        try { if (connectedInputPort != null) connectedInputPort.close(); } catch (Exception ignored) {}
        try { if (connectedDevice != null) connectedDevice.close(); } catch (Exception ignored) {}
        connectedOutputPort = null;
        connectedInputPort = null;
        connectedReceiver = null;
        connectedDevice = null;
        connectedDeviceId = -1;
    }

    private String getDeviceName(MidiDeviceInfo info) {
        String name = info.getProperties().getString(MidiDeviceInfo.PROPERTY_NAME);
        return name == null || name.trim().isEmpty() ? "Dispositivo MIDI" : name.trim();
    }

    private String getDeviceManufacturer(MidiDeviceInfo info) {
        String manufacturer = info.getProperties().getString(MidiDeviceInfo.PROPERTY_MANUFACTURER);
        return manufacturer == null ? "" : manufacturer;
    }

    private String mapDeviceType(int type) {
        if (type == MidiDeviceInfo.TYPE_USB) return "usb";
        if (type == MidiDeviceInfo.TYPE_BLUETOOTH) return "ble";
        if (type == MidiDeviceInfo.TYPE_VIRTUAL) return "virtual";
        return "unknown";
    }

    private JSArray toJSArray(byte[] data) {
        JSArray array = new JSArray();
        for (byte value : data) array.put(value & 0xFF);
        return array;
    }

    private String safeDeviceName(BluetoothDevice device) {
        try {
            String name = device.getName();
            return name == null || name.trim().isEmpty() ? "Dispositivo BLE MIDI" : name.trim();
        } catch (SecurityException e) { return "Dispositivo BLE MIDI"; }
    }

    private String safeBluetoothAddress(BluetoothDevice device) {
        try {
            String address = device.getAddress();
            return address == null ? "" : address;
        } catch (SecurityException e) { return ""; }
    }

    private boolean hasBluetoothScanPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasBluetoothConnectPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasBluetoothAdvertisePermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return true;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    protected void handleOnDestroy() {
        closeConnectedDevice();
        stopBleMidiServer();
        if (midiManager != null && deviceCallbackRegistered && deviceCallback != null) {
            try { midiManager.unregisterDeviceCallback(deviceCallback); } catch (Exception ignored) {}
        }
        if (deviceCallbackExecutor != null && !deviceCallbackExecutor.isShutdown()) {
            deviceCallbackExecutor.shutdownNow();
        }
        super.handleOnDestroy();
    }
}
