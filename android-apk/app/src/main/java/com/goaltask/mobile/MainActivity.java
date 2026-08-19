package com.goaltask.mobile;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private Button overlayButton;
    private final ActivityResultLauncher<String> notifications = registerForActivityResult(
        new ActivityResultContracts.RequestPermission(), granted -> startOverlayIfAllowed());

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_main);
        overlayButton = findViewById(R.id.overlayButton);
        WebView web = findViewById(R.id.webView);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.loadUrl("https://goaltask-mobile.k1ngbr.chatgpt.site");
        overlayButton.setOnClickListener(v -> toggleOverlay());
        updateButton();
    }

    private void toggleOverlay() {
        if (ScoreOverlayService.running) {
            stopService(new Intent(this, ScoreOverlayService.class));
            overlayButton.postDelayed(this::updateButton, 250);
            return;
        }
        if (!Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "Permita que o GoalTask apareça sobre outros apps.", Toast.LENGTH_LONG).show();
            startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())));
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notifications.launch(Manifest.permission.POST_NOTIFICATIONS);
        } else startOverlayIfAllowed();
    }

    private void startOverlayIfAllowed() {
        if (!Settings.canDrawOverlays(this)) return;
        startForegroundService(new Intent(this, ScoreOverlayService.class));
        overlayButton.postDelayed(this::updateButton, 300);
    }

    private void updateButton() {
        overlayButton.setText(ScoreOverlayService.running ? "Desativar" : "Ativar placar");
    }

    @Override protected void onResume() {
        super.onResume();
        if (Settings.canDrawOverlays(this) && !ScoreOverlayService.running) startOverlayIfAllowed();
        updateButton();
    }

    @Override public void onBackPressed() {
        WebView web = findViewById(R.id.webView);
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
