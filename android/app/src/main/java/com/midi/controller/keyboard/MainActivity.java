package com.midi.controller.keyboard;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.midi.controller.keyboard.plugins.NativeMidiPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeMidiPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
