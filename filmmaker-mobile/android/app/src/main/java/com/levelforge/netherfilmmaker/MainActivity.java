package com.levelforge.netherfilmmaker;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MobileCapabilitiesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
