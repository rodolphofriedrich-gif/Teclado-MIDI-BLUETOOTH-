package com.midi.controller.keyboard.plugins;

import android.annotation.SuppressLint;
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
import android.content.Context;
import android.os.ParcelUuid;

import java.io.ByteArrayOutputStream;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Servidor BLE MIDI (modo periférico): o aparelho passa a aparecer como um instrumento
 * "Bluetooth MIDI" para outros dispositivos (DAWs, celulares, computadores), seguindo a
 * especificação "MIDI over Bluetooth Low Energy" da MMA/Apple.
 *
 * - MIDI recebido do dispositivo remoto → {@link Listener#onMidi(byte[])} (fluxo MIDI cru, sem timestamps).
 * - MIDI enviado pelo app → {@link #sendMidi(byte[])} (notificação BLE para quem assinou).
 *
 * As permissões (BLUETOOTH_ADVERTISE / BLUETOOTH_CONNECT no Android 12+) devem ser concedidas
 * antes de chamar {@link #start(StartCallback)}.
 */
@SuppressLint("MissingPermission")
public class BleMidiServer {

    public static final UUID MIDI_SERVICE_UUID = UUID.fromString("03B80E5A-EDE8-4B33-A751-6CE34EC4C700");
    public static final UUID MIDI_CHARACTERISTIC_UUID = UUID.fromString("7772E5DB-3868-4112-A1A9-F2669D106BF3");
    private static final UUID CCCD_UUID = UUID.fromString("00002902-0000-1000-8000-00805F9B34FB");

    /** Tamanho útil mínimo de uma notificação (MTU padrão 23 − 3 bytes de cabeçalho ATT). */
    private static final int DEFAULT_PAYLOAD = 20;

    public interface Listener {
        /** Bytes MIDI recebidos (já sem cabeçalho/timestamps do BLE MIDI). */
        void onMidi(byte[] midiBytes);

        /** O número de clientes conectados ou o estado do servidor mudou. */
        void onStateChanged();
    }

    public interface StartCallback {
        void onResult(boolean success, String errorMessage);
    }

    private final Context context;
    private final Listener listener;

    private BluetoothManager bluetoothManager;
    private BluetoothGattServer gattServer;
    private BluetoothLeAdvertiser advertiser;
    private BluetoothGattCharacteristic midiCharacteristic;
    private StartCallback pendingStart;
    private volatile boolean running = false;

    private final Set<BluetoothDevice> connected = ConcurrentHashMap.newKeySet();
    private final Set<BluetoothDevice> subscribed = ConcurrentHashMap.newKeySet();

    public BleMidiServer(Context context, Listener listener) {
        this.context = context.getApplicationContext();
        this.listener = listener;
    }

    public boolean isRunning() {
        return running;
    }

    public int getClientCount() {
        return connected.size();
    }

    // ------------------------------------------------------------------ ciclo de vida
    public void start(StartCallback callback) {
        if (running) {
            callback.onResult(true, null);
            return;
        }

        bluetoothManager = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = bluetoothManager != null ? bluetoothManager.getAdapter() : null;
        if (adapter == null || !adapter.isEnabled()) {
            callback.onResult(false, "Bluetooth desativado ou indisponível");
            return;
        }

        advertiser = adapter.getBluetoothLeAdvertiser();
        if (advertiser == null) {
            callback.onResult(false, "Este aparelho não suporta anunciar BLE (modo periférico)");
            return;
        }

        gattServer = bluetoothManager.openGattServer(context, gattCallback);
        if (gattServer == null) {
            callback.onResult(false, "Não foi possível abrir o servidor GATT");
            return;
        }

        midiCharacteristic = new BluetoothGattCharacteristic(
                MIDI_CHARACTERISTIC_UUID,
                BluetoothGattCharacteristic.PROPERTY_READ
                        | BluetoothGattCharacteristic.PROPERTY_WRITE
                        | BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE
                        | BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                BluetoothGattCharacteristic.PERMISSION_READ | BluetoothGattCharacteristic.PERMISSION_WRITE);

        BluetoothGattDescriptor cccd = new BluetoothGattDescriptor(
                CCCD_UUID,
                BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE);
        midiCharacteristic.addDescriptor(cccd);

        BluetoothGattService service = new BluetoothGattService(MIDI_SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY);
        service.addCharacteristic(midiCharacteristic);

        pendingStart = callback;
        // O anúncio começa em onServiceAdded, quando o serviço estiver registrado.
        if (!gattServer.addService(service)) {
            pendingStart = null;
            cleanup();
            callback.onResult(false, "Não foi possível registrar o serviço BLE MIDI");
        }
    }

    public void stop() {
        if (advertiser != null) {
            try {
                advertiser.stopAdvertising(advertiseCallback);
            } catch (Exception ignored) {
            }
        }
        cleanup();
        listener.onStateChanged();
    }

    private void cleanup() {
        running = false;
        pendingStart = null;
        subscribed.clear();
        connected.clear();
        if (gattServer != null) {
            try {
                gattServer.close();
            } catch (Exception ignored) {
            }
            gattServer = null;
        }
        advertiser = null;
        midiCharacteristic = null;
    }

    private void startAdvertising() {
        AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(true)
                .setTimeout(0)
                .build();

        // O UUID de 128 bits ocupa quase todo o pacote de anúncio; o nome vai na resposta de scan.
        AdvertiseData data = new AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .addServiceUuid(new ParcelUuid(MIDI_SERVICE_UUID))
                .build();
        AdvertiseData scanResponse = new AdvertiseData.Builder()
                .setIncludeDeviceName(true)
                .build();

        advertiser.startAdvertising(settings, data, scanResponse, advertiseCallback);
    }

    private final AdvertiseCallback advertiseCallback = new AdvertiseCallback() {
        @Override
        public void onStartSuccess(AdvertiseSettings settingsInEffect) {
            running = true;
            StartCallback callback = pendingStart;
            pendingStart = null;
            if (callback != null) callback.onResult(true, null);
            listener.onStateChanged();
        }

        @Override
        public void onStartFailure(int errorCode) {
            StartCallback callback = pendingStart;
            cleanup();
            if (callback != null) callback.onResult(false, describeAdvertiseError(errorCode));
            listener.onStateChanged();
        }
    };

    private static String describeAdvertiseError(int code) {
        switch (code) {
            case AdvertiseCallback.ADVERTISE_FAILED_DATA_TOO_LARGE:
                return "Dados de anúncio BLE grandes demais";
            case AdvertiseCallback.ADVERTISE_FAILED_TOO_MANY_ADVERTISERS:
                return "Muitos anúncios BLE ativos no aparelho";
            case AdvertiseCallback.ADVERTISE_FAILED_ALREADY_STARTED:
                return "O anúncio BLE já está ativo";
            case AdvertiseCallback.ADVERTISE_FAILED_FEATURE_UNSUPPORTED:
                return "Este aparelho não suporta anúncio BLE";
            default:
                return "Falha ao iniciar o anúncio BLE (código " + code + ")";
        }
    }

    // ------------------------------------------------------------------ GATT
    private final BluetoothGattServerCallback gattCallback = new BluetoothGattServerCallback() {

        @Override
        public void onServiceAdded(int status, BluetoothGattService service) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                startAdvertising();
            } else {
                StartCallback callback = pendingStart;
                cleanup();
                if (callback != null) callback.onResult(false, "Falha ao registrar o serviço BLE MIDI (código " + status + ")");
                listener.onStateChanged();
            }
        }

        @Override
        public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                connected.add(device);
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                connected.remove(device);
                subscribed.remove(device);
            }
            listener.onStateChanged();
        }

        @Override
        public void onCharacteristicReadRequest(BluetoothDevice device, int requestId, int offset, BluetoothGattCharacteristic characteristic) {
            // A especificação manda responder a leitura com um valor vazio.
            if (gattServer != null) {
                gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, new byte[0]);
            }
        }

        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId, BluetoothGattCharacteristic characteristic,
                                                 boolean preparedWrite, boolean responseNeeded, int offset, byte[] value) {
            if (MIDI_CHARACTERISTIC_UUID.equals(characteristic.getUuid()) && value != null) {
                byte[] midi = BleMidiPacket.toMidiStream(value);
                if (midi.length > 0) listener.onMidi(midi);
            }
            if (responseNeeded && gattServer != null) {
                gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
            }
        }

        @Override
        public void onDescriptorWriteRequest(BluetoothDevice device, int requestId, BluetoothGattDescriptor descriptor,
                                             boolean preparedWrite, boolean responseNeeded, int offset, byte[] value) {
            if (CCCD_UUID.equals(descriptor.getUuid()) && value != null && value.length >= 1) {
                boolean enable = (value[0] & 0x01) != 0; // 0x01 = notificações, 0x02 = indicações
                if (enable) subscribed.add(device);
                else subscribed.remove(device);
            }
            if (responseNeeded && gattServer != null) {
                gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
            }
            listener.onStateChanged();
        }

        @Override
        public void onDescriptorReadRequest(BluetoothDevice device, int requestId, int offset, BluetoothGattDescriptor descriptor) {
            if (gattServer == null) return;
            byte[] value = subscribed.contains(device)
                    ? BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                    : BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE;
            gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, value);
        }
    };

    // ------------------------------------------------------------------ envio
    /** Envia uma mensagem MIDI (cabe em uma notificação) a todos os clientes inscritos. */
    @SuppressWarnings("deprecation")
    public void sendMidi(byte[] midiBytes) {
        if (!running || gattServer == null || midiCharacteristic == null || subscribed.isEmpty()) return;
        byte[] packet = BleMidiPacket.fromMidiMessage(midiBytes, System.currentTimeMillis(), DEFAULT_PAYLOAD);
        if (packet == null) return;

        for (BluetoothDevice device : subscribed) {
            try {
                midiCharacteristic.setValue(packet);
                gattServer.notifyCharacteristicChanged(device, midiCharacteristic, false);
            } catch (Exception ignored) {
                // Cliente saiu entre a checagem e o envio.
            }
        }
    }

    /**
     * Conversão entre pacotes BLE MIDI e fluxo MIDI comum. Separada em classe estática
     * para poder ser validada sem hardware.
     */
    static final class BleMidiPacket {
        private BleMidiPacket() {}

        /**
         * Remove o cabeçalho e os timestamps de um pacote BLE MIDI, devolvendo o fluxo MIDI cru
         * (com running status preservado, que o app já sabe interpretar).
         *
         * Formato: [cabeçalho 10tttttt] ([timestamp 1ttttttt] [status] [dados...])*
         * Todo status é precedido por um timestamp; no running status há timestamp seguido só de dados.
         */
        static byte[] toMidiStream(byte[] packet) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            if (packet == null || packet.length < 2) return out.toByteArray();

            boolean afterTimestamp = false;
            for (int i = 1; i < packet.length; i++) { // i = 0 é o cabeçalho
                int b = packet[i] & 0xFF;
                if ((b & 0x80) == 0) {
                    out.write(b); // byte de dados
                } else if (afterTimestamp) {
                    out.write(b); // status (inclui tempo real e SysEx)
                    afterTimestamp = false;
                } else {
                    afterTimestamp = true; // byte de timestamp (descartado)
                    boolean nextIsData = i + 1 < packet.length && (packet[i + 1] & 0x80) == 0;
                    if (nextIsData) afterTimestamp = false; // timestamp + running status
                }
            }
            return out.toByteArray();
        }

        /**
         * Monta um pacote BLE MIDI com uma única mensagem.
         * @return o pacote, ou null se a mensagem não couber em {@code maxPayload}.
         */
        static byte[] fromMidiMessage(byte[] midi, long timestampMs, int maxPayload) {
            if (midi == null || midi.length == 0 || midi.length + 2 > maxPayload) return null;
            int ts = (int) (timestampMs & 0x1FFF); // 13 bits
            byte[] packet = new byte[midi.length + 2];
            packet[0] = (byte) (0x80 | ((ts >> 7) & 0x3F));
            packet[1] = (byte) (0x80 | (ts & 0x7F));
            System.arraycopy(midi, 0, packet, 2, midi.length);
            return packet;
        }
    }
}
