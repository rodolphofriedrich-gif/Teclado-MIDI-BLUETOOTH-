
package com.midi.controller.keyboard.plugins;

import android.Manifest;
import android.content.Context;
import android.media.midi.MidiDevice;
import android.media.midi.MidiDeviceInfo;
import android.media.midi.MidiInputPort;
import android.media.midi.MidiManager;
import android.media.midi.MidiOutputPort;
import android.media.midi.MidiReceiver;
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

    private final Map<String, MidiDevice> openedDevices = new HashMap<>();
    private final Map<String, MidiInputPort> activeInputPorts = new HashMap<>();
    private final Map<String, MidiOutputPort> activeOutputPorts = new HashMap<>();

    @Override
    public void load() {
        super.load();
        midiManager = (MidiManager)
            getContext().getSystemService(Context.MIDI_SERVICE);
    }

    @PluginMethod
    public void getDevices(PluginCall call) {
        JSArray devicesArray = new JSArray();

        if (midiManager == null) {
            JSObject result = new JSObject();
            result.put("devices", devicesArray);
            call.resolve(result);
            return;
        }

        for (MidiDeviceInfo info : midiManager.getDevices()) {
            JSObject deviceObject = new JSObject();
            String id = String.valueOf(info.getId());

            Bundle properties = info.getProperties();

            String name = properties != null
                ? properties.getString(MidiDeviceInfo.PROPERTY_PRODUCT_NAME)
                : null;

            if (name == null && properties != null) {
                name = properties.getString(
                    MidiDeviceInfo.PROPERTY_MANUFACTURER_NAME
                );
            }

            if (name == null) {
                name = "Dispositivo MIDI";
            }

            deviceObject.put("id", id);
            deviceObject.put("name", name);
            deviceObject.put("displayName", name);
            deviceObject.put("type", "usb");
            deviceObject.put("inputPortCount", info.getInputPortCount());
            deviceObject.put("outputPortCount", info.getOutputPortCount());

            devicesArray.put(deviceObject);
        }

        JSObject result = new JSObject();
        result.put("devices", devicesArray);
        call.resolve(result);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String id = call.getString("id");
        Integer portIndex = call.getInt("portIndex", 0);

        if (id == null) {
            call.reject("ID de dispositivo obrigatório");
            return;
        }

        openOutputPortForDevice(
            id,
            portIndex != null ? portIndex : 0,
            call
        );
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        String id = call.getString("id");

        if (id != null) {
            closeOutputPort(id);
        }

        call.resolve();
    }

    @PluginMethod
    public void connectInput(PluginCall call) {
        String id = call.getString("id");
        Integer portIndex = call.getInt("portIndex", 0);

        if (id == null) {
            call.reject("ID de entrada obrigatório");
            return;
        }

        openInputPortForDevice(
            id,
            portIndex != null ? portIndex : 0,
            call
        );
    }

    @PluginMethod
    public void disconnectInput(PluginCall call) {
        String id = call.getString("id");

        if (id != null) {
            closeInputPort(id);
        }

        call.resolve();
    }

    @PluginMethod
    public void send(PluginCall call) {
        JSArray dataArray = call.getArray("data");
        String outputId = call.getString("outputId");

        if (dataArray == null || dataArray.length() == 0) {
            call.reject("Dados MIDI não informados");
            return;
        }

        if (outputId == null) {
            call.reject("ID da saída MIDI não informado");
            return;
        }

        MidiInputPort inputPort = activeInputPorts.get(outputId);

        if (inputPort == null) {
            call.reject("Porta MIDI de saída não está conectada");
            return;
        }

        try {
            byte[] bytes = new byte[dataArray.length()];

            for (int i = 0; i < dataArray.length(); i++) {
                int value = dataArray.getInt(i);

                if (value < 0 || value > 255) {
                    call.reject("Valor MIDI inválido: " + value);
                    return;
                }

                bytes[i] = (byte) value;
            }

            inputPort.send(bytes, 0, bytes.length, 0);
            call.resolve();

        } catch (Exception e) {
            call.reject("Erro ao enviar MIDI: " + e.getMessage());
        }
    }

    private void openOutputPortForDevice(
        String id,
        int portIndex,
        PluginCall call
    ) {
        if (midiManager == null) {
            call.reject("MidiManager indisponível");
            return;
        }

        MidiDeviceInfo targetInfo = findDevice(id);

        if (targetInfo == null) {
            call.reject("Dispositivo MIDI não encontrado");
            return;
        }

        if (portIndex < 0 ||
            portIndex >= targetInfo.getInputPortCount()) {
            call.reject("Índice da porta MIDI de destino inválido");
            return;
        }

        midiManager.openDevice(targetInfo, device -> {
            if (device == null) {
                call.reject("Falha ao abrir dispositivo MIDI");
                return;
            }

            MidiInputPort inputPort = device.openInputPort(portIndex);

            if (inputPort == null) {
                closeDevice(device);
                call.reject("Falha ao abrir porta de entrada do destino MIDI");
                return;
            }

            MidiInputPort oldPort = activeInputPorts.put(id, inputPort);
            if (oldPort != null) {
                closePort(oldPort);
            }

            MidiDevice oldDevice = openedDevices.put(id, device);
            if (oldDevice != null && oldDevice != device) {
                closeDevice(oldDevice);
            }

            call.resolve();

        }, new Handler(Looper.getMainLooper()));
    }

    private void openInputPortForDevice(
        String id,
        int portIndex,
        PluginCall call
    ) {
        if (midiManager == null) {
            call.reject("MidiManager indisponível");
            return;
        }

        MidiDeviceInfo targetInfo = findDevice(id);

        if (targetInfo == null) {
            call.reject("Dispositivo MIDI de entrada não encontrado");
            return;
        }

        if (portIndex < 0 ||
            portIndex >= targetInfo.getOutputPortCount()) {
            call.reject("Índice da porta MIDI de entrada inválido");
            return;
        }

        midiManager.openDevice(targetInfo, device -> {
            if (device == null) {
                call.reject("Falha ao abrir dispositivo MIDI de entrada");
                return;
            }

            MidiOutputPort outputPort = device.openOutputPort(portIndex);

            if (outputPort == null) {
                closeDevice(device);
                call.reject("Falha ao abrir porta de saída do controlador");
                return;
            }

            try {
                outputPort.connect(new MidiReceiver() {
                    @Override
                    public void onSend(
                        byte[] data,
                        int offset,
                        int count,
                        long timestamp
                    ) throws IOException {

                        JSObject midiMessage = new JSObject();
                        JSArray messageData = new JSArray();

                        for (int i = offset; i < offset + count; i++) {
                            messageData.put(data[i] & 0xFF);
                        }

                        midiMessage.put("data", messageData);
                        midiMessage.put("sourceId", id);

                        notifyListeners("midiMessage", midiMessage);
                    }
                });

                MidiOutputPort oldPort =
                    activeOutputPorts.put(id, outputPort);

                if (oldPort != null) {
                    closePort(oldPort);
                }

                MidiDevice oldDevice = openedDevices.put(id, device);

                if (oldDevice != null && oldDevice != device) {
                    closeDevice(oldDevice);
                }

                call.resolve();

            } catch (IOException e) {
                closePort(outputPort);
                closeDevice(device);
                call.reject(
                    "Erro ao conectar receptor MIDI: " + e.getMessage()
                );
            }

        }, new Handler(Looper.getMainLooper()));
    }

    private MidiDeviceInfo findDevice(String id) {
        for (MidiDeviceInfo info : midiManager.getDevices()) {
            if (String.valueOf(info.getId()).equals(id)) {
                return info;
            }
        }

        return null;
    }

    private void closeOutputPort(String id) {
        MidiInputPort port = activeInputPorts.remove(id);

        if (port != null) {
            closePort(port);
        }

        MidiDevice device = openedDevices.remove(id);

        if (device != null) {
            closeDevice(device);
        }
    }

    private void closeInputPort(String id) {
        MidiOutputPort port = activeOutputPorts.remove(id);

        if (port != null) {
            closePort(port);
        }

        MidiDevice device = openedDevices.remove(id);

        if (device != null) {
            closeDevice(device);
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
        call.resolve();
    }

    @PluginMethod
    public void stopBleServer(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void scanBleDevices(PluginCall call) {
        JSObject result = new JSObject();
        result.put("devices", new JSArray());
        call.resolve(result);
    }

    @PluginMethod
    public void connectBleDevice(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void disconnectBleDevice(PluginCall call) {
        call.resolve();
    }
}
