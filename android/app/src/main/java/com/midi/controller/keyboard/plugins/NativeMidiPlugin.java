package com.midi.controller.keyboard.plugins;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.media.midi.MidiDevice;
import android.media.midi.MidiDeviceInfo;
import android.media.midi.MidiInputPort;
import android.media.midi.MidiManager;
import android.media.midi.MidiOutputPort;
import android.media.midi.MidiReceiver;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@CapacitorPlugin(
    name = "NativeMidi",
    permissions = {
        @Permission(
            strings = {
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_ADVERTISE
            },
            alias = "bluetooth"
        )
    }
)
public class NativeMidiPlugin extends Plugin {

    private MidiManager midiManager;

    // Dispositivos abertos para enviar MIDI ao equipamento.
    private final Map<String, MidiDevice> outputDevices = new HashMap<>();
    private final Map<String, MidiInputPort> outputPorts = new HashMap<>();

    // Dispositivos abertos para receber MIDI do equipamento.
    private final Map<String, MidiDevice> inputDevices = new HashMap<>();
    private final Map<String, MidiOutputPort> inputPorts = new HashMap<>();

    private final Handler mainHandler =
        new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        super.load();

        midiManager = (MidiManager)
            getContext().getSystemService(Context.MIDI_SERVICE);
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        if (midiManager == null) {
            call.reject("MidiManager indisponível neste dispositivo");
            return;
        }

        call.resolve();
    }

    @PluginMethod
    public void getDevices(PluginCall call) {
        JSArray devicesArray = new JSArray();

        if (midiManager != null) {
            for (MidiDeviceInfo info : midiManager.getDevices()) {
                JSObject item = new JSObject();
                Bundle properties = info.getProperties();

                String name = null;
                String manufacturer = null;

                if (properties != null) {
                    name = properties.getString(
                        "name"
                    );

                    manufacturer = properties.getString(
                "name"
                    );
                }

                if (name == null || name.trim().isEmpty()) {
                    name = manufacturer != null
                        ? manufacturer
                        : "Dispositivo MIDI";
                }

                item.put("id", String.valueOf(info.getId()));
                item.put("name", name);
                item.put("displayName", name);
                item.put("type", getDeviceType(info));
                item.put("inputPortCount", info.getInputPortCount());
                item.put("outputPortCount", info.getOutputPortCount());

                if (manufacturer != null) {
                    item.put("manufacturer", manufacturer);
                }

                devicesArray.put(item);
            }
        }

        JSObject result = new JSObject();
        result.put("devices", devicesArray);
        call.resolve(result);
    }

    private String getDeviceType(MidiDeviceInfo info) {
        switch (info.getType()) {
            case MidiDeviceInfo.TYPE_USB:
                return "usb";

            case MidiDeviceInfo.TYPE_BLUETOOTH:
                return "ble";

            case MidiDeviceInfo.TYPE_VIRTUAL:
                return "virtual";

            default:
                return "unknown";
        }
    }

    private int getPortIndex(PluginCall call) {
        Integer index = call.getInt("portIndex");

        if (index == null) {
            index = call.getInt("port");
        }

        return index != null ? index : 0;
    }

    @PluginMethod
    public void connect(PluginCall call) {
        connectOutputInternal(call);
    }

    @PluginMethod
    public void connectOutput(PluginCall call) {
        connectOutputInternal(call);
    }

    private void connectOutputInternal(PluginCall call) {
        String id = call.getString("id");

        if (id == null || id.trim().isEmpty()) {
            call.reject("ID do dispositivo de saída obrigatório");
            return;
        }

        int portIndex = getPortIndex(call);

        MidiDeviceInfo info = findDevice(id);

        if (info == null) {
            call.reject("Dispositivo MIDI de saída não encontrado");
            return;
        }

        if (portIndex < 0 ||
            portIndex >= info.getInputPortCount()) {
            call.reject("Índice da porta de saída inválido");
            return;
        }

        midiManager.openDevice(info, device -> {
            if (device == null) {
                call.reject("Não foi possível abrir o dispositivo de saída");
                return;
            }

            MidiInputPort port = device.openInputPort(portIndex);

            if (port == null) {
                closeDevice(device);
                call.reject("Não foi possível abrir a porta MIDI de destino");
                return;
            }

            MidiInputPort oldPort = outputPorts.put(id, port);
            MidiDevice oldDevice = outputDevices.put(id, device);

            if (oldPort != null) {
                closePort(oldPort);
            }

            if (oldDevice != null && oldDevice != device) {
                closeDevice(oldDevice);
            }

            JSObject result = new JSObject();
            result.put("id", id);
            result.put("name", getDeviceName(info));
            call.resolve(result);

        }, mainHandler);
    }

    @PluginMethod
    public void connectInput(PluginCall call) {
        String id = call.getString("id");
        int portIndex = call.getInt("port", 0);

        if (id == null || id.isEmpty()) {
            call.reject("Identificador do dispositivo não informado");
            return;
        }

        MidiDeviceInfo info = findDevice(id);
        if (info == null) {
            call.reject("Dispositivo MIDI não encontrado");
            return;
        }

        midiManager.openDevice(info, device -> {
            if (device == null) {
                call.reject("Não foi possível abrir o dispositivo de entrada");
                return;
            }

            MidiOutputPort port = device.openOutputPort(portIndex);
            if (port == null) {
                closeDevice(device);
                call.reject("Não foi possível abrir a porta MIDI de origem");
                return;
            }

            port.connect(new MidiReceiver() {
                @Override
                public void onSend(
                    byte[] data,
                    int offset,
                    int count,
                    long timestamp
                ) throws IOException {
                    JSArray messageData = new JSArray();

                    for (int i = offset; i < offset + count; i++) {
                        messageData.put(data[i] & 0xFF);
                    }

                    JSObject message = new JSObject();
                    message.put("data", messageData);
                    message.put("sourceId", id);
                    notifyListeners("midiMessage", message);
                }
            });

            MidiOutputPort oldPort = inputPorts.put(id, port);
            MidiDevice oldDevice = inputDevices.put(id, device);

            if (oldPort != null) {
                closePort(oldPort);
            }

            if (oldDevice != null && oldDevice != device) {
                closeDevice(oldDevice);
            }

            JSObject result = new JSObject();
            result.put("id", id);
            result.put("name", getDeviceName(info));
            result.put("port", portIndex);
            call.resolve(result);

        }, mainHandler);
    }

    @PluginMethod
    public void disconnectOutput(PluginCall call) {
        String id = call.getString("id");

        if (id != null) {
            closeOutputConnection(id);
        } else {
            closeAllOutputConnections();
        }

        call.resolve();
    }

    @PluginMethod
    public void disconnectInput(PluginCall call) {
        String id = call.getString("id");

        if (id != null) {
            closeInputConnection(id);
        } else {
            closeAllInputConnections();
        }

        call.resolve();
    }

    @PluginMethod
    public void send(PluginCall call) {
        sendToDevice(call);
    }

    @PluginMethod
    public void sendTo(PluginCall call) {
        sendToDevice(call);
    }

    private void sendToDevice(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            id = call.getString("outputId");
        }

        JSArray data = call.getArray("data");

        if (id == null || id.trim().isEmpty()) {
            call.reject("ID da saída MIDI não informado");
            return;
        }

        if (data == null || data.length() == 0) {
            call.reject("Dados MIDI não informados");
            return;
        }

        MidiInputPort port = outputPorts.get(id);

        if (port == null) {
            call.reject("Saída MIDI não está conectada");
            return;
        }

        try {
            byte[] bytes = new byte[data.length()];

            for (int i = 0; i < data.length(); i++) {
                int value = data.getInt(i);

                if (value < 0 || value > 255) {
                    call.reject("Byte MIDI inválido: " + value);
                    return;
                }

                bytes[i] = (byte) value;
            }

            port.send(bytes, 0, bytes.length, 0);
            call.resolve();

        } catch (Exception e) {
            call.reject("Falha no envio MIDI: " + e.getMessage());
        }
    }

    private MidiDeviceInfo findDevice(String id) {
        if (midiManager == null) {
            return null;
        }

        for (MidiDeviceInfo info : midiManager.getDevices()) {
            if (String.valueOf(info.getId()).equals(id)) {
                return info;
            }
        }

        return null;
    }

    private String getDeviceName(MidiDeviceInfo info) {
        Bundle properties = info.getProperties();

        if (properties != null) {
            String name = properties.getString(
                "name"
            );

            if (name != null && !name.trim().isEmpty()) {
                return name;
            }
        }

        return "Dispositivo MIDI";
    }

    private void closeOutputConnection(String id) {
        MidiInputPort port = outputPorts.remove(id);
        if (port != null) {
            closePort(port);
        }

        MidiDevice device = outputDevices.remove(id);
        if (device != null) {
            closeDevice(device);
        }
    }

    private void closeInputConnection(String id) {
        MidiOutputPort port = inputPorts.remove(id);
        if (port != null) {
            closePort(port);
        }

        MidiDevice device = inputDevices.remove(id);
        if (device != null) {
            closeDevice(device);
        }
    }

    private void closeAllOutputConnections() {
        for (String id : outputPorts.keySet().toArray(new String[0])) {
            closeOutputConnection(id);
        }
    }

    private void closeAllInputConnections() {
        for (String id : inputPorts.keySet().toArray(new String[0])) {
            closeInputConnection(id);
        }
    }

    private void closePort(MidiInputPort port) {
        try {
            port.close();
        } catch (IOException ignored) {
        }
    }

    private void closePort(MidiOutputPort port) {
        try {
            port.close();
        } catch (IOException ignored) {
        }
    }

    private void closeDevice(MidiDevice device) {
        try {
            device.close();
        } catch (IOException ignored) {
        }
    }

    @PluginMethod
    public void startBleServer(PluginCall call) {
        // Ainda não existe servidor BLE MIDI implementado neste plugin.
        JSObject result = new JSObject();
        result.put("active", false);
        result.put("clients", 0);
        call.resolve(result);
    }

    @PluginMethod
    public void stopBleServer(PluginCall call) {
        JSObject result = new JSObject();
        result.put("active", false);
        result.put("clients", 0);
        call.resolve(result);
    }

    @PluginMethod
    public void isBleServerRunning(PluginCall call) {
        JSObject result = new JSObject();
        result.put("active", false);
        result.put("clients", 0);
        call.resolve(result);
    }

    @PluginMethod
    public void scanBleDevices(PluginCall call) {
        // A busca BLE MIDI ainda precisa de implementação real.
        JSObject result = new JSObject();
        result.put("devices", new JSArray());
        call.resolve(result);
    }

    @PluginMethod
    public void scanBluetoothMidi(PluginCall call) {
        scanBleDevices(call);
    }

    @PluginMethod
    public void fecharApp(PluginCall call) {
        Activity activity = getActivity();

        if (activity != null) {
            activity.runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    activity.finishAndRemoveTask();
                } else {
                    activity.finish();
                }
            });
        }

        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        closeAllInputConnections();
        closeAllOutputConnections();
        super.handleOnDestroy();
    }
}
