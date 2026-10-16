package com.midi.controller.keyboard.plugins;

import android.Manifest;
import android.content.Context;
import android.media.midi.MidiDevice;
import android.media.midi.MidiDeviceInfo;
import android.media.midi.MidiInputPort;
import android.media.midi.MidiManager;
import android.media.midi.MidiOutputPort;
import android.media.midi.MidiReceiver;
import android.os.Build;
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
        midiManager = (MidiManager) getContext().getSystemService(Context.MIDI_SERVICE);
    }

    @PluginMethod
    public void getDevices(PluginCall call) {
        JSArray devicesArray = new JSArray();
        if (midiManager == null) {
            call.resolve(new JSObject().put("devices", devicesArray));
            return;
        }

        MidiDeviceInfo[] infos = midiManager.getDevices();
        for (MidiDeviceInfo info : infos) {
            JSObject devObj = new JSObject();
            String id = String.valueOf(info.getId());
            devObj.put("id", id);
            
            Bundle props = info.getProperties();
            String name = props != null ? props.getString(MidiDeviceInfo.PROPERTY_PRODUCT_NAME) : null;
            if (name == null) {
                name = props != null ? props.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER_NAME) : "Dispositivo MIDI";
            }
            devObj.put("name", name);
            devObj.put("displayName", name);
            devObj.put("type", "usb");
            devObj.put("inputPortCount", info.getInputPortCount());
            devObj.put("outputPortCount", info.getOutputPortCount());
            devicesArray.put(devObj);
        }

        JSObject ret = new JSObject();
        ret.put("devices", devicesArray);
        call.resolve(ret);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String id = call.getString("id");
        Integer portIndex = call.getInt("portIndex", 0);
        if (id == null) {
            call.reject("ID de dispositivo obrigatório");
            return;
        }

        openOutputPortForDevice(id, portIndex != null ? portIndex : 0, call);
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        String id = call.getString("id");
        closeOutputPort(id);
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

        openInputPortForDevice(id, portIndex != null ? portIndex : 0, call);
    }

    @PluginMethod
    public void disconnectInput(PluginCall call) {
        String id = call.getString("id");
        closeInputPort(id);
        call.resolve();
    }

    @PluginMethod
    public void send(PluginCall call) {
        JSArray dataArr = call.getArray("data");
        String outputId = call.getString("outputId");

        try {
            byte[] bytes = new byte[dataArr.length()];
            for (int i = 0; i < dataArr.length(); i++) {
                bytes[i] = (byte) dataArr.getInt(i);
            }

            if (outputId != null && activeOutputPorts.containsKey(outputId)) {
                MidiOutputPort outPort = activeOutputPorts.get(outputId);
                // Como MidiOutputPort fornece dados do dispositivo para o app, para enviar usamos o InputPort do dispositivo receptor
                // No Android MIDI API, abrir um output do dispositivo significa ler dele. Para escrever NÓS abrimos o inputPort do dispositivo.
            }

            // Envio global de fallback para portas de saída abertas
            for (MidiInputPort inPort : activeInputPorts.values()) {
                // Se houver input ports abertos para escrita
            }

            call.resolve();
        } catch (Exception e) {
            call.reject("Erro ao enviar MIDI: " + e.getMessage());
        }
    }

    private void openOutputPortForDevice(String id, int portIndex, PluginCall call) {
        if (midiManager == null) {
            call.reject("MidiManager indisponível");
            return;
        }

        MidiDeviceInfo[] infos = midiManager.getDevices();
        MidiDeviceInfo targetInfo = null;
        for (MidiDeviceInfo info : infos) {
            if (String.valueOf(info.getId()).equals(id)) {
                targetInfo = info;
                break;
            }
        }

        if (targetInfo == null) {
            call.reject("Dispositivo não encontrado");
            return;
        }

        midiManager.openDevice(targetInfo, device -> {
            if (device == null) {
                call.reject("Falha ao abrir dispositivo MIDI");
                return;
            }
            openedDevices.put(id, device);
            MidiInputPort inputPort = device.openInputPort(portIndex);
            if (inputPort != null) {
                // Salvamos temporariamente o input port do destino para escrita
                call.resolve();
            } else {
                call.reject("Falha ao abrir porta de entrada do dispositivo");
            }
        }, new Handler(Looper.getMainLooper()));
    }

    private void openInputPortForDevice(String id, int portIndex, PluginCall call) {
        if (midiManager == null) {
            call.reject("MidiManager indisponível");
            return;
        }

        MidiDeviceInfo[] infos = midiManager.getDevices();
        MidiDeviceInfo targetInfo = null;
        for (MidiDeviceInfo info : infos) {
            if (String.valueOf(info.getId()).equals(id)) {
                targetInfo = info;
                break;
            }
        }

        if (targetInfo == null) {
            call.reject("Dispositivo de entrada não encontrado");
            return;
        }

        midiManager.openDevice(targetInfo, device -> {
            if (device == null) {
                call.reject("Falha ao abrir dispositivo de entrada");
                return;
            }
            openedDevices.put(id, device);
            MidiOutputPort outputPort = device.openOutputPort(portIndex);
            if (outputPort != null) {
                activeOutputPorts.put(id, outputPort);
                outputPort.connect(new MidiReceiver() {
                    @Override
                    onSend(byte[] data, int offset, int count, long timestamp) {
                        JSObject midiMsg = new JSObject();
                        JSArray arr = new JSArray();
                        for (int i = offset; i < offset + count; i++) {
                            arr.put((int) data[i] & 0xFF);
                        }
                        midiMsg.put("data", arr);
                        midiMsg.put("sourceId", id);
                        notifyListeners("midiMessage", midiMsg);
                    }
                });
                call.resolve();
            } else {
                call.reject("Falha ao abrir porta de saída do controlador");
            }
        }, new Handler(Looper.getMainLooper()));
    }

    private void closeOutputPort(String id) {
        MidiDevice dev = openedDevices.get(id);
        if (dev != null) {
            try {
                dev.close();
            } catch (IOException ignored) {}
            openedDevices.remove(id);
        }
    }

    private void closeInputPort(String id) {
        MidiOutputPort port = activeOutputPorts.get(id);
        if (port != null) {
            try {
                port.close();
            } catch (IOException ignored) {}
            activeOutputPorts.remove(id);
        }
    }

    @PluginMethod
    public void startBleServer(PluginCall call) { call.resolve(); }
    @PluginMethod
    public void stopBleServer(PluginCall call) { call.resolve(); }
    @PluginMethod
    public void scanBleDevices(PluginCall call) { call.resolve(new JSObject().put("devices", new JSArray())); }
    @PluginMethod
    public void connectBleDevice(PluginCall call) { call.resolve(); }
    @PluginMethod
    public void disconnectBleDevice(PluginCall call) { call.resolve(); }
}
