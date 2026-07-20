package dev.frnco.micerebro;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(YoutubeDlPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
