package com.midi.controller.keyboard.plugins;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "NativeMidi",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT
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

    @Override
    public void load() {
        midiManager = (MidiManager) getContext().getSystemService(Activity.MIDI_SERVICE);
        BluetoothManager bluetoothManager = (BluetoothManager) getContext().getSystemService(Activity.BLUETOOTH_SERVICE);
        if (bluetoothManager != null) {
            bluetoothAdapter = bluetoothManager.getAdapter();
        }
        registerMidiDeviceCallback();
    }

    private void registerMidiDeviceCallback() {
        if (midiManager == null || deviceCallbackRegistered) return;

        deviceCallback = new MidiManager.DeviceCallback() {
            @Override
            public void onDeviceAdded(MidiDeviceInfo device) {
                notifyDevicesChanged();
            }

            @Override
            public void onDeviceRemoved(MidiDeviceInfo device) {
                if (connectedDeviceId == device.getId()) {
                    closeConnectedDevice();
                }
                notifyDevicesChanged();
            }

            @Override
            public void onDeviceStatusChanged(MidiDeviceStatus status) {
                notifyDevicesChanged();
            }
        };

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            midiManager.registerDeviceCallback(
                MidiManager.TRANSPORT_MIDI_BYTE_STREAM,
                deviceCallbackExecutor,
                deviceCallback
            );
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
        } catch (SecurityException ignored) {
        }

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
        for (MidiDeviceInfo info : midiManager.getDevices()) {
            devices.add(info);
        }
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
            if (device == null) {
                device = bluetoothAdapter.getRemoteDevice(address);
            }

            final BluetoothDevice target = device;
            midiManager.openBluetoothDevice(target, midiDevice -> {
                if (midiDevice == null) {
                    call.reject("O Android não conseguiu abrir o dispositivo Bluetooth MIDI.");
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
                        if (connectedInputPort != null) {
                            break;
                        }
                    }
                }
            }

            if (connectedInputPort == null) {
                closeConnectedDevice();
                call.reject("A porta MIDI está ocupada por outra aplicação ou o cabo USB não suporta envio.");
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

        if (connectedInputPort == null) {
            call.reject("Nenhum destino MIDI está conectado.");
            return;
        }

        try {
            List<Object> values = dataArray.toList();
            byte[] data = new byte[values.size()];

            for (int i = 0; i < values.size(); i++) {
                int number = ((Number) values.get(i)).intValue();
                if (number < 0 || number > 255) {
                    throw new IllegalArgumentException("Byte MIDI fora da faixa: " + number);
                }
                data[i] = (byte) number;
            }

            connectedInputPort.send(data, 0, data.length);
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

            // CORREÇÃO: Filtro vazio para achar dispositivos que "escondem" o UUID
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

                    addresses.add(address);
                    scannedBluetoothDevices.put(address, device);

                    JSObject item = new JSObject();
                    item.put("address", address);
                    item.put("name", safeDeviceName(device));
                    found.add(item);
                }

                @Override
                public void onScanFailed(int errorCode) {
                    stopScanSafely(this);
                    call.reject("Falha na busca BLE. Código Android: " + errorCode);
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
            if (hasBluetoothScanPermission()) {
                bleScanner.stopScan(callback);
            }
        } catch (Exception ignored) {
        }
    }

    private MidiDeviceInfo findDevice(int id) {
        for (MidiDeviceInfo info : getByteStreamDevices()) {
            if (info.getId() == id) return info;
        }
        return null;
    }

    private void closeConnectedDevice() {
        try {
            if (connectedOutputPort != null && connectedReceiver != null) {
                connectedOutputPort.disconnect(connectedReceiver);
            }
        } catch (Exception ignored) {
        }

        try {
            if (connectedOutputPort != null) connectedOutputPort.close();
        } catch (Exception ignored) {
        }

        try {
            if (connectedInputPort != null) connectedInputPort.close();
        } catch (Exception ignored) {
        }

        try {
            if (connectedDevice != null) connectedDevice.close();
        } catch (Exception ignored) {
        }

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
        } catch (SecurityException e) {
            return "Dispositivo BLE MIDI";
        }
    }

    private boolean hasBluetoothScanPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_SCAN)
            == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasBluetoothConnectPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT)
            == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return true;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    protected void handleOnDestroy() {
        closeConnectedDevice();
        if (midiManager != null && deviceCallbackRegistered && deviceCallback != null) {
            try {
                midiManager.unregisterDeviceCallback(deviceCallback);
            } catch (Exception ignored) {
            }
        }
        
        if (deviceCallbackExecutor != null && !deviceCallbackExecutor.isShutdown()) {
            deviceCallbackExecutor.shutdownNow();
        }
        
        super.handleOnDestroy();
    }
}
