package com.midi.controller.keyboard.plugins;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
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
    // BLE MIDI STANDARD
    // =========================================================

    /*
     * UUID oficial do serviço MIDI over Bluetooth LE.
     *
     * IMPORTANTE:
     * O UUID usado anteriormente estava incorreto.
     */
    private static final UUID MIDI_BLE_SERVICE_UUID =
        UUID.fromString("03B80E5A-EDE8-4B33-A751-6CE34EC4C700");

    private static final UUID MIDI_BLE_CHARACTERISTIC_UUID =
        UUID.fromString("7772E5DB-3868-4112-A1A9-F2669D106BF3");

    private static final UUID CLIENT_CHARACTERISTIC_CONFIG_UUID =
        UUID.fromString("00002902-0000-1000-8000-00805F9B34FB");

    // =========================================================
    // ANDROID MIDI
    // =========================================================

    private MidiManager midiManager;

    private BluetoothAdapter bluetoothAdapter;

    private BluetoothLeScanner bleScanner;

    private final Handler mainHandler =
        new Handler(Looper.getMainLooper());

    private final ExecutorService deviceCallbackExecutor =
        Executors.newSingleThreadExecutor();

    private MidiManager.DeviceCallback deviceCallback;

    private boolean deviceCallbackRegistered = false;

    private MidiDevice connectedDevice;

    private MidiInputPort connectedInputPort;

    private MidiOutputPort connectedOutputPort;

    private MidiReceiver connectedReceiver;

    private int connectedDeviceId = -1;

    // =========================================================
    // BLE CLIENT / SCANNER
    // =========================================================

    private final Map<String, BluetoothDevice> scannedBluetoothDevices =
        new HashMap<>();

    // =========================================================
    // BLE MIDI PERIPHERAL / GATT SERVER
    // =========================================================

    private BluetoothGattServer bluetoothGattServer;

    private BluetoothLeAdvertiser bluetoothLeAdvertiser;

    private BluetoothGattCharacteristic midiGattCharacteristic;

    private AdvertiseCallback advertiseCallback;

    private boolean bleMidiPeripheralRunning = false;

    private final Set<BluetoothDevice> bleMidiConnectedClients =
        new HashSet<>();

    private final Set<BluetoothDevice> bleMidiNotificationClients =
        new HashSet<>();

    // =========================================================
    // LOAD
    // =========================================================

    @Override
    public void load() {

        midiManager =
            (MidiManager) getContext()
                .getSystemService(Activity.MIDI_SERVICE);

        BluetoothManager bluetoothManager =
            (BluetoothManager) getContext()
                .getSystemService(Activity.BLUETOOTH_SERVICE);

        if (bluetoothManager != null) {
            bluetoothAdapter = bluetoothManager.getAdapter();
        }

        registerMidiDeviceCallback();
    }

    // =========================================================
    // FECHAR APLICATIVO
    // =========================================================

    @PluginMethod
    public void fecharApp(PluginCall call) {

        Activity activity = getActivity();

        if (activity == null) {
            call.reject(
                "Não foi possível obter a Activity principal."
            );
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

    // =========================================================
    // MIDI DEVICE CALLBACK
    // =========================================================

    private void registerMidiDeviceCallback() {

        if (midiManager == null || deviceCallbackRegistered) {
            return;
        }

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
            public void onDeviceStatusChanged(
                MidiDeviceStatus status
            ) {
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

            midiManager.registerDeviceCallback(
                deviceCallback,
                new Handler(Looper.getMainLooper())
            );
        }

        deviceCallbackRegistered = true;
    }

    private void notifyDevicesChanged() {

        notifyListeners(
            "devicesChanged",
            new JSObject()
        );
    }

    // =========================================================
    // INITIALIZE
    // =========================================================

    @PluginMethod
    public void initialize(PluginCall call) {

        if (midiManager == null) {

            call.reject(
                "O serviço MIDI do Android não está disponível neste aparelho."
            );

            return;
        }

        /*
         * O aplicativo tenta iniciar automaticamente seu
         * periférico BLE MIDI.
         *
         * Se Android 12+ ainda não concedeu BLUETOOTH_ADVERTISE,
         * solicitamos as permissões primeiro.
         */
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {

            if (
                !hasBluetoothScanPermission() ||
                !hasBluetoothConnectPermission() ||
                !hasBluetoothAdvertisePermission()
            ) {

                requestPermissionForAlias(
                    "bluetooth",
                    call,
                    "bluetoothPermissionForInitializeResult"
                );

                return;
            }
        }

        startBleMidiPeripheral();

        call.resolve();
    }

    @PermissionCallback
    private void bluetoothPermissionForInitializeResult(
        PluginCall call
    ) {

        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            getPermissionState("bluetooth") != PermissionState.GRANTED
        ) {

            call.reject(
                "Permissões Bluetooth necessárias não foram concedidas."
            );

            return;
        }

        startBleMidiPeripheral();

        call.resolve();
    }

    // =========================================================
    // BLUETOOTH STATE
    // =========================================================

    @PluginMethod
    public void isBluetoothEnabled(PluginCall call) {

        try {

            boolean enabled =
                bluetoothAdapter != null &&
                bluetoothAdapter.isEnabled();

            JSObject result = new JSObject();

            result.put("enabled", enabled);

            call.resolve(result);

        } catch (SecurityException e) {

            call.reject(
                "Permissão Bluetooth não concedida.",
                e
            );
        }
    }

    // =========================================================
    // REQUEST ENABLE BLUETOOTH
    // =========================================================

    @PluginMethod
    public void requestEnableBluetooth(PluginCall call) {

        if (bluetoothAdapter == null) {

            call.reject(
                "Bluetooth não está disponível neste aparelho."
            );

            return;
        }

        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            !hasBluetoothConnectPermission()
        ) {

            requestPermissionForAlias(
                "bluetooth",
                call,
                "bluetoothPermissionForEnableResult"
            );

            return;
        }

        launchBluetoothEnableIntent(call);
    }

    @PermissionCallback
    private void bluetoothPermissionForEnableResult(
        PluginCall call
    ) {

        if (
            getPermissionState("bluetooth") !=
            PermissionState.GRANTED
        ) {

            call.reject(
                "Permissão Bluetooth negada."
            );

            return;
        }

        launchBluetoothEnableIntent(call);
    }

    private void launchBluetoothEnableIntent(
        PluginCall call
    ) {

        try {

            if (bluetoothAdapter.isEnabled()) {

                startBleMidiPeripheral();

                JSObject result = new JSObject();

                result.put("enabled", true);

                call.resolve(result);

                return;
            }

        } catch (SecurityException e) {

            call.reject(
                "Permissão Bluetooth não concedida.",
                e
            );

            return;
        }

        Intent intent =
            new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);

        startActivityForResult(
            call,
            intent,
            "bluetoothEnableResult"
        );
    }

    @ActivityCallback
    private void bluetoothEnableResult(
        PluginCall call,
        ActivityResult result
    ) {

        boolean enabled = false;

        try {

            enabled =
                bluetoothAdapter != null &&
                bluetoothAdapter.isEnabled();

        } catch (SecurityException ignored) {
        }

        if (enabled) {
            startBleMidiPeripheral();
        }

        JSObject response = new JSObject();

        response.put("enabled", enabled);

        call.resolve(response);
    }

    // =========================================================
    // GET MIDI DEVICES
    // =========================================================

    @PluginMethod
    public void getDevices(PluginCall call) {

        if (midiManager == null) {

            call.reject(
                "MidiManager não disponível."
            );

            return;
        }

        try {

            Set<MidiDeviceInfo> devices =
                getByteStreamDevices();

            JSArray array = new JSArray();

            for (MidiDeviceInfo info : devices) {

                if (info.getInputPortCount() <= 0) {
                    continue;
                }

                JSObject item = new JSObject();

                item.put(
                    "id",
                    info.getId()
                );

                item.put(
                    "name",
                    getDeviceName(info)
                );

                item.put(
                    "manufacturer",
                    getDeviceManufacturer(info)
                );

                item.put(
                    "type",
                    mapDeviceType(info.getType())
                );

                item.put(
                    "inputPortCount",
                    info.getInputPortCount()
                );

                item.put(
                    "outputPortCount",
                    info.getOutputPortCount()
                );

                array.put(item);
            }

            JSObject result = new JSObject();

            result.put(
                "devices",
                array
            );

            call.resolve(result);

        } catch (Exception e) {

            call.reject(
                "Não foi possível consultar os dispositivos MIDI.",
                e
            );
        }
    }

    private Set<MidiDeviceInfo> getByteStreamDevices() {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {

            return midiManager.getDevicesForTransport(
                MidiManager.TRANSPORT_MIDI_BYTE_STREAM
            );
        }

        Set<MidiDeviceInfo> devices =
            new HashSet<>();

        for (
            MidiDeviceInfo info :
            midiManager.getDevices()
        ) {

            devices.add(info);
        }

        return devices;
    }

    // =========================================================
    // CONNECT NORMAL MIDI
    // =========================================================

    @PluginMethod
    public void connect(PluginCall call) {

        String idString =
            call.getString("id");

        int port =
            call.getInt("port", 0);

        if (idString == null) {

            call.reject(
                "ID do dispositivo MIDI não informado."
            );

            return;
        }

        try {

            int deviceId =
                Integer.parseInt(idString);

            MidiDeviceInfo target =
                findDevice(deviceId);

            if (target == null) {

                call.reject(
                    "Dispositivo MIDI não encontrado. Atualize a lista."
                );

                return;
            }

            openMidiDevice(
                target,
                port,
                call
            );

        } catch (NumberFormatException e) {

            call.reject(
                "ID MIDI inválido."
            );
        }
    }

    // =========================================================
    // CONNECT BLUETOOTH MIDI CLIENT
    // =========================================================

    @PluginMethod
    public void connectBluetooth(PluginCall call) {

        String address =
            call.getString("address");

        int port =
            call.getInt("port", 0);

        if (
            address == null ||
            address.trim().isEmpty()
        ) {

            call.reject(
                "Endereço Bluetooth não informado."
            );

            return;
        }

        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            !hasBluetoothConnectPermission()
        ) {

            requestPermissionForAlias(
                "bluetooth",
                call,
                "bluetoothPermissionForConnectResult"
            );

            return;
        }

        openBluetoothDevice(
            address,
            port,
            call
        );
    }

    @PermissionCallback
    private void bluetoothPermissionForConnectResult(
        PluginCall call
    ) {

        if (
            getPermissionState("bluetooth") !=
            PermissionState.GRANTED
        ) {

            call.reject(
                "Permissão Bluetooth negada."
            );

            return;
        }

        String address =
            call.getString("address");

        int port =
            call.getInt("port", 0);

        if (address == null) {

            call.reject(
                "Endereço Bluetooth não informado."
            );

            return;
        }

        openBluetoothDevice(
            address,
            port,
            call
        );
    }

    private void openBluetoothDevice(
        String address,
        int port,
        PluginCall call
    ) {

        if (
            bluetoothAdapter == null ||
            midiManager == null
        ) {

            call.reject(
                "Bluetooth MIDI não está disponível."
            );

            return;
        }

        try {

            BluetoothDevice device =
                scannedBluetoothDevices.get(address);

            if (device == null) {

                device =
                    bluetoothAdapter.getRemoteDevice(address);
            }

            final BluetoothDevice target =
                device;

            midiManager.openBluetoothDevice(
                target,
                midiDevice -> {

                    if (midiDevice == null) {

                        call.reject(
                            "O Android não conseguiu abrir o canal BLE MIDI com este dispositivo."
                        );

                        return;
                    }

                    openPortsAndResolve(
                        midiDevice,
                        port,
                        call
                    );
                },
                mainHandler
            );

        } catch (IllegalArgumentException e) {

            call.reject(
                "Endereço Bluetooth inválido.",
                e
            );

        } catch (SecurityException e) {

            call.reject(
                "Permissão Bluetooth não concedida.",
                e
            );
        }
    }

    // =========================================================
    // OPEN NORMAL MIDI DEVICE
    // =========================================================

    private void openMidiDevice(
        MidiDeviceInfo target,
        int port,
        PluginCall call
    ) {

        midiManager.openDevice(
            target,
            midiDevice -> {

                if (midiDevice == null) {

                    call.reject(
                        "O Android não conseguiu abrir o dispositivo MIDI."
                    );

                    return;
                }

                openPortsAndResolve(
                    midiDevice,
                    port,
                    call
                );
            },
            mainHandler
        );
    }

    // =========================================================
    // OPEN MIDI PORTS
    // =========================================================

    private void openPortsAndResolve(
        MidiDevice device,
        int port,
        PluginCall call
    ) {

        try {

            closeConnectedDevice();

            if (
                port < 0 ||
                port >= device
                    .getInfo()
                    .getInputPortCount()
            ) {

                device.close();

                call.reject(
                    "Porta MIDI inválida: " + port
                );

                return;
            }

            connectedDevice =
                device;

            connectedDeviceId =
                device.getInfo().getId();

            connectedInputPort =
                device.openInputPort(port);

            if (connectedInputPort == null) {

                for (
                    int i = 0;
                    i < device
                        .getInfo()
                        .getInputPortCount();
                    i++
                ) {

                    if (i != port) {

                        connectedInputPort =
                            device.openInputPort(i);

                        if (
                            connectedInputPort != null
                        ) {
                            break;
                        }
                    }
                }
            }

            if (connectedInputPort == null) {

                closeConnectedDevice();

                call.reject(
                    "A porta MIDI está ocupada por outra aplicação ou o dispositivo não suporta envio."
                );

                return;
            }

            if (
                device
                    .getInfo()
                    .getOutputPortCount() > 0
            ) {

                connectedOutputPort =
                    device.openOutputPort(0);

                if (connectedOutputPort != null) {

                    connectedReceiver =
                        new MidiReceiver() {

                            @Override
                            public void onSend(
                                byte[] msg,
                                int offset,
                                int count,
                                long timestamp
                            ) throws IOException {

                                byte[] copy =
                                    new byte[count];

                                System.arraycopy(
                                    msg,
                                    offset,
                                    copy,
                                    0,
                                    count
                                );

                                JSObject event =
                                    new JSObject();

                                event.put(
                                    "data",
                                    toJSArray(copy)
                                );

                                event.put(
                                    "timestamp",
                                    timestamp
                                );

                                notifyListeners(
                                    "midiMessage",
                                    event
                                );

                                /*
                                 * Se o nosso aplicativo também
                                 * estiver atuando como periférico
                                 * BLE MIDI, repassamos o MIDI
                                 * recebido para o cliente BLE.
                                 */
                                sendBleMidiNotification(copy);
                            }
                        };

                    connectedOutputPort.connect(
                        connectedReceiver
                    );
                }
            }

            JSObject result =
                new JSObject();

            result.put(
                "id",
                String.valueOf(
                    connectedDeviceId
                )
            );

            result.put(
                "name",
                getDeviceName(
                    device.getInfo()
                )
            );

            call.resolve(result);

            notifyDevicesChanged();

        } catch (Exception e) {

            closeConnectedDevice();

            call.reject(
                "Falha ao abrir o dispositivo MIDI: " +
                e.getMessage(),
                e
            );
        }
    }

    // =========================================================
    // SEND MIDI
    // =========================================================

    @PluginMethod
    public void send(PluginCall call) {

        JSArray dataArray =
            call.getArray("data");

        if (dataArray == null) {

            call.reject(
                "Nenhum dado MIDI foi informado."
            );

            return;
        }

        try {

            List<Object> values =
                dataArray.toList();

            byte[] data =
                new byte[values.size()];

            for (
                int i = 0;
                i < values.size();
                i++
            ) {

                int number =
                    ((Number) values.get(i))
                        .intValue();

                if (
                    number < 0 ||
                    number > 255
                ) {

                    throw new IllegalArgumentException(
                        "Byte MIDI fora da faixa: " +
                        number
                    );
                }

                data[i] =
                    (byte) number;
            }

            boolean sent = false;

            /*
             * Caminho MIDI nativo Android.
             */
            if (connectedInputPort != null) {

                connectedInputPort.send(
                    data,
                    0,
                    data.length
                );

                sent = true;
            }

            /*
             * Caminho BLE MIDI periférico.
             */
            if (!bleMidiNotificationClients.isEmpty()) {

                sendBleMidiNotification(data);

                sent = true;
            }

            if (!sent) {

                call.reject(
                    "Nenhum destino MIDI conectado."
                );

                return;
            }

            call.resolve();

        } catch (Exception e) {

            call.reject(
                "Falha ao enviar MIDI: " +
                e.getMessage(),
                e
            );
        }
    }

    // =========================================================
    // DISCONNECT MIDI
    // =========================================================

    @PluginMethod
    public void disconnect(PluginCall call) {

        closeConnectedDevice();

        call.resolve();

        notifyDevicesChanged();
    }

    // =========================================================
    // BLE MIDI SCAN
    // =========================================================

    @PluginMethod
    public void scanBluetoothMidi(
        PluginCall call
    ) {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {

            if (
                !hasBluetoothScanPermission() ||
                !hasBluetoothConnectPermission()
            ) {

                requestPermissionForAlias(
                    "bluetooth",
                    call,
                    "bluetoothPermissionForScanResult"
                );

                return;
            }

        } else {

            if (!hasLocationPermission()) {

                requestPermissionForAlias(
                    "location",
                    call,
                    "locationPermissionForScanResult"
                );

                return;
            }
        }

        startBleMidiScan(call);
    }

    @PermissionCallback
    private void bluetoothPermissionForScanResult(
        PluginCall call
    ) {

        if (
            getPermissionState("bluetooth") !=
            PermissionState.GRANTED
        ) {

            call.reject(
                "Permissão Bluetooth negada."
            );

            return;
        }

        startBleMidiScan(call);
    }

    @PermissionCallback
    private void locationPermissionForScanResult(
        PluginCall call
    ) {

        if (
            getPermissionState("location") !=
            PermissionState.GRANTED
        ) {

            call.reject(
                "Permissão de localização necessária para a busca BLE neste Android."
            );

            return;
        }

        startBleMidiScan(call);
    }

    // =========================================================
    // START BLE MIDI SCAN
    // =========================================================

    private void startBleMidiScan(
        final PluginCall call
    ) {

        if (bluetoothAdapter == null) {

            call.reject(
                "Bluetooth não está disponível neste aparelho."
            );

            return;
        }

        try {

            if (!bluetoothAdapter.isEnabled()) {

                call.reject(
                    "O Bluetooth está desligado."
                );

                return;
            }

            bleScanner =
                bluetoothAdapter
                    .getBluetoothLeScanner();

            if (bleScanner == null) {

                call.reject(
                    "O scanner BLE não está disponível."
                );

                return;
            }

            final List<JSObject> found =
                new ArrayList<>();

            final Set<String> addresses =
                new HashSet<>();

            /*
             * Agora filtramos diretamente pelo serviço
             * MIDI BLE padrão.
             *
             * Isso elimina boa parte dos falsos positivos
             * encontrados pela busca BLE genérica.
             */
            List<ScanFilter> filters =
                new ArrayList<>();

            filters.add(
                new ScanFilter.Builder()
                    .setServiceUuid(
                        new ParcelUuid(
                            MIDI_BLE_SERVICE_UUID
                        )
                    )
                    .build()
            );

            ScanSettings settings =
                new ScanSettings.Builder()
                    .setScanMode(
                        ScanSettings.SCAN_MODE_LOW_LATENCY
                    )
                    .build();

            final ScanCallback callback =
                new ScanCallback() {

                    @Override
                    public void onScanResult(
                        int callbackType,
                        ScanResult result
                    ) {

                        BluetoothDevice device =
                            result.getDevice();

                        if (device == null) {
                            return;
                        }

                        String address;

                        try {

                            address =
                                device.getAddress();

                        } catch (SecurityException e) {

                            return;
                        }

                        if (
                            address == null ||
                            addresses.contains(address)
                        ) {

                            return;
                        }

                        String name =
                            safeDeviceName(device);

                        addresses.add(address);

                        scannedBluetoothDevices.put(
                            address,
                            device
                        );

                        JSObject item =
                            new JSObject();

                        item.put(
                            "address",
                            address
                        );

                        item.put(
                            "name",
                            name
                        );

                        found.add(item);
                    }

                    @Override
                    public void onScanFailed(
                        int errorCode
                    ) {

                        stopScanSafely(this);

                        call.reject(
                            "Falha na busca BLE. Código Android: " +
                            errorCode
                        );
                    }
                };

            bleScanner.startScan(
                filters,
                settings,
                callback
            );

            long requestedDuration =
                call.getInt(
                    "durationMs",
                    15000
                );

            final long duration =
                Math.max(
                    1000,
                    Math.min(
                        requestedDuration,
                        30000
                    )
                );

            mainHandler.postDelayed(
                () -> {

                    stopScanSafely(callback);

                    JSArray resultArray =
                        new JSArray();

                    for (
                        JSObject item :
                        found
                    ) {

                        resultArray.put(item);
                    }

                    JSObject result =
                        new JSObject();

                    result.put(
                        "devices",
                        resultArray
                    );

                    call.resolve(result);

                },
                duration
            );

        } catch (SecurityException e) {

            call.reject(
                "Permissão Bluetooth não concedida.",
                e
            );

        } catch (Exception e) {

            call.reject(
                "Não foi possível iniciar a busca BLE MIDI.",
                e
            );
        }
    }

    private void stopScanSafely(
        ScanCallback callback
    ) {

        if (bleScanner == null) {
            return;
        }

        try {

            if (hasBluetoothScanPermission()) {

                bleScanner.stopScan(
                    callback
                );
            }

        } catch (Exception ignored) {
        }
    }

    // =========================================================
    // BLE MIDI PERIPHERAL
    // =========================================================

    /**
     * Inicia o celular como um dispositivo BLE MIDI.
     *
     * O tablet/PC/iPad poderá encontrar este celular como
     * periférico BLE MIDI.
     */
    private void startBleMidiPeripheral() {

        if (bluetoothAdapter == null) {
            return;
        }

        if (!bluetoothAdapter.isEnabled()) {
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {

            if (
                !hasBluetoothAdvertisePermission() ||
                !hasBluetoothConnectPermission()
            ) {
                return;
            }
        }

        if (bleMidiPeripheralRunning) {
            return;
        }

        try {

            if (
                !bluetoothAdapter
                    .isMultipleAdvertisementSupported()
            ) {

                notifyBlePeripheralError(
                    "Este aparelho não suporta BLE advertising."
                );

                return;
            }

            BluetoothManager bluetoothManager =
                (BluetoothManager) getContext()
                    .getSystemService(
                        Activity.BLUETOOTH_SERVICE
                    );

            if (bluetoothManager == null) {

                notifyBlePeripheralError(
                    "BluetoothManager não disponível."
                );

                return;
            }

            /*
             * =================================================
             * GATT SERVER
             * =================================================
             */

            bluetoothGattServer =
                bluetoothManager.openGattServer(
                    getContext(),
                    gattServerCallback
                );

            if (bluetoothGattServer == null) {

                notifyBlePeripheralError(
                    "Não foi possível abrir o servidor BLE GATT."
                );

                return;
            }

            BluetoothGattService midiService =
                new BluetoothGattService(
                    MIDI_BLE_SERVICE_UUID,
                    BluetoothGattService.SERVICE_TYPE_PRIMARY
                );

            /*
             * A característica MIDI BLE precisa permitir
             * escrita e notificações.
             */
            midiGattCharacteristic =
                new BluetoothGattCharacteristic(
                    MIDI_BLE_CHARACTERISTIC_UUID,
                    BluetoothGattCharacteristic.PROPERTY_READ |
                    BluetoothGattCharacteristic.PROPERTY_WRITE |
                    BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE |
                    BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                    BluetoothGattCharacteristic.PERMISSION_READ |
                    BluetoothGattCharacteristic.PERMISSION_WRITE
                );

            BluetoothGattDescriptor cccDescriptor =
                new BluetoothGattDescriptor(
                    CLIENT_CHARACTERISTIC_CONFIG_UUID,
                    BluetoothGattDescriptor.PERMISSION_READ |
                    BluetoothGattDescriptor.PERMISSION_WRITE
                );

            midiGattCharacteristic.addDescriptor(
                cccDescriptor
            );

            midiService.addCharacteristic(
                midiGattCharacteristic
            );

            boolean added =
                bluetoothGattServer.addService(
                    midiService
                );

            if (!added) {

                bluetoothGattServer.close();

                bluetoothGattServer = null;

                notifyBlePeripheralError(
                    "Não foi possível registrar o serviço MIDI BLE."
                );

                return;
            }

            /*
             * =================================================
             * BLE ADVERTISING
             * =================================================
             */

            bluetoothLeAdvertiser =
                bluetoothAdapter
                    .getBluetoothLeAdvertiser();

            if (bluetoothLeAdvertiser == null) {

                bluetoothGattServer.close();

                bluetoothGattServer = null;

                notifyBlePeripheralError(
                    "O Bluetooth LE Advertiser não está disponível."
                );

                return;
            }

            AdvertiseSettings advertiseSettings =
                new AdvertiseSettings.Builder()
                    .setAdvertiseMode(
                        AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY
                    )
                    .setTxPowerLevel(
                        AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM
                    )
                    .setConnectable(true)
                    .build();

            AdvertiseData advertiseData =
                new AdvertiseData.Builder()
                    .addServiceUuid(
                        new ParcelUuid(
                            MIDI_BLE_SERVICE_UUID
                        )
                    )
                    .setIncludeDeviceName(false)
                    .build();

            /*
             * O nome vai no scan response para não
             * consumir o espaço principal do advertisement.
             */
            String deviceName =
                "MIDI Router Hub";

            try {

                bluetoothAdapter.setName(
                    deviceName
                );

            } catch (SecurityException ignored) {
            }

            AdvertiseData scanResponse =
                new AdvertiseData.Builder()
                    .setIncludeDeviceName(true)
                    .build();

            advertiseCallback =
                new AdvertiseCallback() {

                    @Override
                    public void onStartSuccess(
                        AdvertiseSettings settingsInEffect
                    ) {

                        bleMidiPeripheralRunning =
                            true;

                        JSObject event =
                            new JSObject();

                        event.put(
                            "name",
                            deviceName
                        );

                        event.put(
                            "service",
                            MIDI_BLE_SERVICE_UUID.toString()
                        );

                        notifyListeners(
                            "bleMidiPeripheralStarted",
                            event
                        );
                    }

                    @Override
                    public void onStartFailure(
                        int errorCode
                    ) {

                        bleMidiPeripheralRunning =
                            false;

                        notifyBlePeripheralError(
                            "Falha ao anunciar BLE MIDI. Código: " +
                            errorCode
                        );
                    }
                };

            bluetoothLeAdvertiser.startAdvertising(
                advertiseSettings,
                advertiseData,
                scanResponse,
                advertiseCallback
            );

        } catch (SecurityException e) {

            notifyBlePeripheralError(
                "Permissão Bluetooth não concedida para o modo periférico."
            );

        } catch (Exception e) {

            notifyBlePeripheralError(
                "Falha ao iniciar o periférico BLE MIDI: " +
                e.getMessage()
            );
        }
    }

    // =========================================================
    // GATT SERVER CALLBACK
    // =========================================================

    private final BluetoothGattServerCallback
        gattServerCallback =
        new BluetoothGattServerCallback() {

            @Override
            public void onConnectionStateChange(
                BluetoothDevice device,
                int status,
                int newState
            ) {

                if (newState ==
                    BluetoothProfile.STATE_CONNECTED) {

                    bleMidiConnectedClients.add(
                        device
                    );

                    JSObject event =
                        new JSObject();

                    event.put(
                        "name",
                        safeDeviceName(device)
                    );

                    event.put(
                        "address",
                        safeDeviceAddress(device)
                    );

                    notifyListeners(
                        "bleMidiConnected",
                        event
                    );

                } else if (
                    newState ==
                    BluetoothProfile.STATE_DISCONNECTED
                ) {

                    bleMidiConnectedClients.remove(
                        device
                    );

                    bleMidiNotificationClients.remove(
                        device
                    );

                    JSObject event =
                        new JSObject();

                    event.put(
                        "name",
                        safeDeviceName(device)
                    );

                    event.put(
                        "address",
                        safeDeviceAddress(device)
                    );

                    notifyListeners(
                        "bleMidiDisconnected",
                        event
                    );
                }
            }

            @Override
            public void onCharacteristicReadRequest(
                BluetoothDevice device,
                int requestId,
                int offset,
                BluetoothGattCharacteristic characteristic
            ) {

                if (
                    MIDI_BLE_CHARACTERISTIC_UUID.equals(
                        characteristic.getUuid()
                    )
                ) {

                    byte[] value =
                        new byte[0];

                    if (
                        bluetoothGattServer != null
                    ) {

                        bluetoothGattServer.sendResponse(
                            device,
                            requestId,
                            0,
                            offset,
                            value
                        );
                    }
                }
            }

            @Override
            public void onCharacteristicWriteRequest(
                BluetoothDevice device,
                int requestId,
                BluetoothGattCharacteristic characteristic,
                boolean preparedWrite,
                boolean responseNeeded,
                int offset,
                byte[] value
            ) {

                if (
                    MIDI_BLE_CHARACTERISTIC_UUID.equals(
                        characteristic.getUuid()
                    )
                ) {

                    /*
                     * O tablet enviou dados MIDI para
                     * o celular.
                     */
                    if (value != null) {

                        handleIncomingBleMidi(
                            value
                        );
                    }

                    if (
                        responseNeeded &&
                        bluetoothGattServer != null
                    ) {

                        bluetoothGattServer.sendResponse(
                            device,
                            requestId,
                            0,
                            offset,
                            null
                        );
                    }
                }
            }

            @Override
            public void onDescriptorWriteRequest(
                BluetoothDevice device,
                int requestId,
                BluetoothGattDescriptor descriptor,
                boolean preparedWrite,
                boolean responseNeeded,
                int offset,
                byte[] value
            ) {

                if (
                    CLIENT_CHARACTERISTIC_CONFIG_UUID
                        .equals(
                            descriptor.getUuid()
                        )
                ) {

                    boolean enabled =
                        value != null &&
                        value.length >= 2 &&
                        (
                            (value[0] & 0xFF) == 0x01 ||
                            (value[0] & 0xFF) == 0x02
                        );

                    if (enabled) {

                        bleMidiNotificationClients.add(
                            device
                        );

                    } else {

                        bleMidiNotificationClients.remove(
                            device
                        );
                    }

                    if (
                        responseNeeded &&
                        bluetoothGattServer != null
                    ) {

                        bluetoothGattServer.sendResponse(
                            device,
                            requestId,
                            0,
                            offset,
                            null
                        );
                    }
                }
            }
        };

    // =========================================================
    // INCOMING BLE MIDI
    // =========================================================

    private void handleIncomingBleMidi(
        byte[] bleData
    ) {

        if (
            bleData == null ||
            bleData.length == 0
        ) {
            return;
        }

        /*
         * Neste primeiro estágio preservamos os bytes
         * recebidos exatamente como chegaram pelo BLE MIDI.
         *
         * Isso permite ao frontend monitorar o tráfego
         * enquanto mantemos o transporte BLE intacto.
         */
        JSObject event =
            new JSObject();

        event.put(
            "data",
            toJSArray(bleData)
        );

        event.put(
            "timestamp",
            System.nanoTime()
        );

        event.put(
            "source",
            "ble-peripheral"
        );

        notifyListeners(
            "midiMessage",
            event
        );
    }

    // =========================================================
    // SEND BLE MIDI NOTIFICATION
    // =========================================================

    private void sendBleMidiNotification(
        byte[] midiData
    ) {

        if (
            bluetoothGattServer == null ||
            midiGattCharacteristic == null ||
            bleMidiNotificationClients.isEmpty() ||
            midiData == null ||
            midiData.length == 0
        ) {
            return;
        }

        try {

            /*
             * Cria um pacote BLE MIDI simples:
             *
             * byte 0 = timestamp high
             * byte 1 = timestamp low
             * bytes seguintes = MIDI
             */
            byte[] packet =
                encodeBleMidiPacket(
                    midiData
                );

            /*
             * BLE ATT tradicional pode trabalhar com
             * pacotes pequenos. Para maior compatibilidade,
             * mantemos o pacote abaixo do limite clássico.
             */
            int maxChunk =
                20;

            for (
                int offset = 0;
                offset < packet.length;
                offset += maxChunk
            ) {

                int count =
                    Math.min(
                        maxChunk,
                        packet.length - offset
                    );

                byte[] chunk =
                    new byte[count];

                System.arraycopy(
                    packet,
                    offset,
                    chunk,
                    0,
                    count
                );

                for (
                    BluetoothDevice device :
                    new HashSet<>(
                        bleMidiNotificationClients
                    )
                ) {

                    try {

                        if (
                            Build.VERSION.SDK_INT >=
                            Build.VERSION_CODES.TIRAMISU
                        ) {

                            bluetoothGattServer
                                .notifyCharacteristicChanged(
                                    device,
                                    midiGattCharacteristic,
                                    false,
                                    chunk
                                );

                        } else {

                            midiGattCharacteristic
                                .setValue(chunk);

                            bluetoothGattServer
                                .notifyCharacteristicChanged(
                                    device,
                                    midiGattCharacteristic,
                                    false
                                );
                        }

                    } catch (SecurityException ignored) {
                    } catch (Exception ignored) {
                    }
                }
            }

        } catch (Exception ignored) {
        }
    }

    // =========================================================
    // BLE MIDI ENCODER
    // =========================================================

    private byte[] encodeBleMidiPacket(
        byte[] midiData
    ) {

        /*
         * BLE MIDI utiliza timestamp de 13 bits.
         *
         * Para compatibilidade, usamos o relógio
         * monotônico do Android e preservamos os
         * 13 bits inferiores.
         */
        long now =
            System.nanoTime() / 1_000_000L;

        int timestamp =
            (int) (now & 0x1FFF);

        byte timestampHigh =
            (byte)
                (0x80 |
                 ((timestamp >> 7) & 0x3F));

        byte timestampLow =
            (byte)
                (0x80 |
                 (timestamp & 0x7F));

        byte[] result =
            new byte[
                midiData.length + 2
            ];

        result[0] =
            timestampHigh;

        result[1] =
            timestampLow;

        System.arraycopy(
            midiData,
            0,
            result,
            2,
            midiData.length
        );

        return result;
    }

    // =========================================================
    // BLE PERIPHERAL ERROR
    // =========================================================

    private void notifyBlePeripheralError(
        String message
    ) {

        JSObject event =
            new JSObject();

        event.put(
            "error",
            message
        );

        notifyListeners(
            "bleMidiPeripheralError",
            event
        );
    }

    // =========================================================
    // STOP BLE MIDI PERIPHERAL
    // =========================================================

    private void stopBleMidiPeripheral() {

        try {

            if (
                bluetoothLeAdvertiser != null &&
                advertiseCallback != null
            ) {

                bluetoothLeAdvertiser.stopAdvertising(
                    advertiseCallback
                );
            }

        } catch (Exception ignored) {
        }

        try {

            if (bluetoothGattServer != null) {

                bluetoothGattServer.close();
            }

        } catch (Exception ignored) {
        }

        bleMidiConnectedClients.clear();

        bleMidiNotificationClients.clear();

        bluetoothGattServer = null;

        bluetoothLeAdvertiser = null;

        midiGattCharacteristic = null;

        advertiseCallback = null;

        bleMidiPeripheralRunning = false;
    }

    // =========================================================
    // CLOSE NORMAL MIDI DEVICE
    // =========================================================

    private void closeConnectedDevice() {

        try {

            if (
                connectedOutputPort != null &&
                connectedReceiver != null
            ) {

                connectedOutputPort.disconnect(
                    connectedReceiver
                );
            }

        } catch (Exception ignored) {
        }

        try {

            if (connectedOutputPort != null) {
                connectedOutputPort.close();
            }

        } catch (Exception ignored) {
        }

        try {

            if (connectedInputPort != null) {
                connectedInputPort.close();
            }

        } catch (Exception ignored) {
        }

        try {

            if (connectedDevice != null) {
                connectedDevice.close();
            }

        } catch (Exception ignored) {
        }

        connectedOutputPort = null;

        connectedInputPort = null;

        connectedReceiver = null;

        connectedDevice = null;

        connectedDeviceId = -1;
    }

    // =========================================================
    // FIND DEVICE
    // =========================================================

    private MidiDeviceInfo findDevice(
        int id
    ) {

        for (
            MidiDeviceInfo info :
            getByteStreamDevices()
        ) {

            if (info.getId() == id) {
                return info;
            }
        }

        return null;
    }

    // =========================================================
    // DEVICE INFORMATION
    // =========================================================

    private String getDeviceName(
        MidiDeviceInfo info
    ) {

        String name =
            info.getProperties()
                .getString(
                    MidiDeviceInfo.PROPERTY_NAME
                );

        return name == null ||
               name.trim().isEmpty()
            ? "Dispositivo MIDI"
            : name.trim();
    }

    private String getDeviceManufacturer(
        MidiDeviceInfo info
    ) {

        String manufacturer =
            info.getProperties()
                .getString(
                    MidiDeviceInfo.PROPERTY_MANUFACTURER
                );

        return manufacturer == null
            ? ""
            : manufacturer;
    }

    private String mapDeviceType(
        int type
    ) {

        if (
            type ==
            MidiDeviceInfo.TYPE_USB
        ) {
            return "usb";
        }

        if (
            type ==
            MidiDeviceInfo.TYPE_BLUETOOTH
        ) {
            return "ble";
        }

        if (
            type ==
            MidiDeviceInfo.TYPE_VIRTUAL
        ) {
            return "virtual";
        }

        return "unknown";
    }

    // =========================================================
    // JS ARRAY
    // =========================================================

    private JSArray toJSArray(
        byte[] data
    ) {

        JSArray array =
            new JSArray();

        for (
            byte value :
            data
        ) {

            array.put(
                value & 0xFF
            );
        }

        return array;
    }

    // =========================================================
    // BLUETOOTH HELPERS
    // =========================================================

    private String safeDeviceName(
        BluetoothDevice device
    ) {

        if (device == null) {
            return "Dispositivo BLE MIDI";
        }

        try {

            String name =
                device.getName();

            return name == null ||
                   name.trim().isEmpty()
                ? "Dispositivo BLE MIDI"
                : name.trim();

        } catch (SecurityException e) {

            return "Dispositivo BLE MIDI";
        }
    }

    private String safeDeviceAddress(
        BluetoothDevice device
    ) {

        if (device == null) {
            return "";
        }

        try {

            return device.getAddress();

        } catch (SecurityException e) {

            return "";
        }
    }

    // =========================================================
    // PERMISSIONS
    // =========================================================

    private boolean hasBluetoothScanPermission() {

        if (
            Build.VERSION.SDK_INT <
            Build.VERSION_CODES.S
        ) {
            return true;
        }

        return ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.BLUETOOTH_SCAN
        ) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasBluetoothConnectPermission() {

        if (
            Build.VERSION.SDK_INT <
            Build.VERSION_CODES.S
        ) {
            return true;
        }

        return ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.BLUETOOTH_CONNECT
        ) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasBluetoothAdvertisePermission() {

        if (
            Build.VERSION.SDK_INT <
            Build.VERSION_CODES.S
        ) {
            return true;
        }

        return ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.BLUETOOTH_ADVERTISE
        ) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasLocationPermission() {

        if (
            Build.VERSION.SDK_INT >=
            Build.VERSION_CODES.S
        ) {
            return true;
        }

        return ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;
    }

    // =========================================================
    // DESTROY
    // =========================================================

    @Override
    protected void handleOnDestroy() {

        stopScanCompletely();

        stopBleMidiPeripheral();

        closeConnectedDevice();

        if (
            midiManager != null &&
            deviceCallbackRegistered &&
            deviceCallback != null
        ) {

            try {

                midiManager.unregisterDeviceCallback(
                    deviceCallback
                );

            } catch (Exception ignored) {
            }
        }

        if (
            deviceCallbackExecutor != null &&
            !deviceCallbackExecutor.isShutdown()
        ) {

            deviceCallbackExecutor.shutdownNow();
        }

        super.handleOnDestroy();
    }

    private void stopScanCompletely() {

        /*
         * Não temos o callback ativo armazenado
         * permanentemente nesta versão.
         *
         * O scanner é interrompido pelo temporizador
         * de cada busca.
         */
    }
}
