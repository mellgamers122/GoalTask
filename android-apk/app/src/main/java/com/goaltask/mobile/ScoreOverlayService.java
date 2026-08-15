package com.goaltask.mobile;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.*;
import android.view.*;
import android.widget.*;
import androidx.core.app.NotificationCompat;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

public class ScoreOverlayService extends Service {
    public static volatile boolean running = false;
    private static final String API = "https://goaltask-api.guinardo298.workers.dev/matches";
    private static final String CHANNEL = "goaltask_live";
    private WindowManager windowManager;
    private LinearLayout overlay;
    private TextView competition, score, status;
    private WindowManager.LayoutParams params;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private String currentMatchId;
    private int previousTotal = -1;

    @Override public void onCreate() {
        super.onCreate();
        running = true;
        createChannel();
        startForeground(10, serviceNotification("Buscando uma partida..."));
        createOverlay();
        scheduler.scheduleWithFixedDelay(this::refreshScore, 0, 15, TimeUnit.SECONDS);
    }

    private void createOverlay() {
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        overlay = new LinearLayout(this);
        overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setPadding(dp(14), dp(9), dp(14), dp(9));
        overlay.setBackground(makeBackground());
        competition = text("GOALTASK • CONECTANDO", 10, Color.rgb(74,222,128), true);
        score = text("⚽ Carregando placar...", 16, Color.WHITE, true);
        status = text("Arraste para mover • toque para abrir", 10, Color.rgb(148,163,184), false);
        overlay.addView(competition); overlay.addView(score); overlay.addView(status);
        params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
            Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        SharedPreferences prefs = getSharedPreferences("overlay", MODE_PRIVATE);
        params.x = prefs.getInt("x", dp(18)); params.y = prefs.getInt("y", dp(90));
        windowManager.addView(overlay, params);
        addGestures();
    }

    private android.graphics.drawable.Drawable makeBackground() {
        android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
        bg.setColor(Color.rgb(16,28,48)); bg.setCornerRadius(dp(14)); bg.setStroke(dp(1), Color.rgb(51,65,85));
        return bg;
    }

    private TextView text(String value, int size, int color, boolean bold) {
        TextView view = new TextView(this); view.setText(value); view.setTextSize(size); view.setTextColor(color);
        if (bold) view.setTypeface(null, android.graphics.Typeface.BOLD);
        return view;
    }

    private void addGestures() {
        overlay.setOnTouchListener(new View.OnTouchListener() {
            int startX, startY; float downX, downY; boolean moved;
            public boolean onTouch(View v, android.view.MotionEvent e) {
                if (e.getAction() == MotionEvent.ACTION_DOWN) {
                    startX=params.x; startY=params.y; downX=e.getRawX(); downY=e.getRawY(); moved=false; return true;
                }
                if (e.getAction() == MotionEvent.ACTION_MOVE) {
                    int dx=(int)(e.getRawX()-downX), dy=(int)(e.getRawY()-downY); moved = moved || Math.abs(dx)+Math.abs(dy)>10;
                    params.x=startX+dx; params.y=startY+dy; windowManager.updateViewLayout(overlay, params); return true;
                }
                if (e.getAction() == MotionEvent.ACTION_UP) {
                    getSharedPreferences("overlay", MODE_PRIVATE).edit().putInt("x",params.x).putInt("y",params.y).apply();
                    if (!moved) startActivity(new Intent(ScoreOverlayService.this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                    return true;
                }
                return false;
            }
        });
    }

    private void refreshScore() {
        try {
            HttpURLConnection connection = (HttpURLConnection) new URL(API).openConnection();
            connection.setConnectTimeout(8000); connection.setReadTimeout(8000); connection.setRequestProperty("Accept", "application/json");
            try (InputStream input = connection.getInputStream()) {
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                byte[] buffer = new byte[4096];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                String body = output.toString(StandardCharsets.UTF_8.name());
                JSONArray matches = new JSONObject(body).optJSONArray("matches");
                JSONObject selected = selectMatch(matches);
                if (selected == null) { updateUi("GOALTASK", "Nenhum jogo encontrado", "Atualiza automaticamente"); return; }
                JSONObject home = selected.optJSONObject("homeTeam"), away = selected.optJSONObject("awayTeam");
                String homeName = teamName(home), awayName = teamName(away), state = selected.optString("status");
                JSONObject full = selected.optJSONObject("score") == null ? null : selected.optJSONObject("score").optJSONObject("fullTime");
                int homeGoals = full == null || full.isNull("home") ? 0 : full.optInt("home");
                int awayGoals = full == null || full.isNull("away") ? 0 : full.optInt("away");
                int total = homeGoals + awayGoals;
                String matchId = String.valueOf(selected.optLong("id"));
                if (matchId.equals(currentMatchId) && previousTotal >= 0 && total > previousTotal) notifyGoal(homeName, homeGoals, awayGoals, awayName);
                currentMatchId = matchId; previousTotal = total;
                String comp = selected.optJSONObject("competition") == null ? "FUTEBOL" : selected.optJSONObject("competition").optString("name", "FUTEBOL");
                String stateText = isLive(state) ? "🔴 AO VIVO • atualiza a cada 15s" : translateState(state);
                updateUi(comp.toUpperCase(), homeName + "  " + homeGoals + " × " + awayGoals + "  " + awayName, stateText);
            } finally { connection.disconnect(); }
        } catch (Exception e) { updateUi("GOALTASK • SEM CONEXÃO", "Não foi possível atualizar", "Tentaremos novamente em 15s"); }
    }

    private JSONObject selectMatch(JSONArray matches) {
        if (matches == null || matches.length() == 0) return null;
        JSONObject upcoming = null;
        for (int i=0;i<matches.length();i++) {
            JSONObject match=matches.optJSONObject(i); if (match==null) continue;
            if (isLive(match.optString("status"))) return match;
            if (upcoming==null && !"FINISHED".equals(match.optString("status"))) upcoming=match;
        }
        return upcoming != null ? upcoming : matches.optJSONObject(0);
    }

    private boolean isLive(String state) { return "IN_PLAY".equals(state)||"PAUSED".equals(state)||"LIVE".equals(state); }
    private String translateState(String state) {
        if ("FINISHED".equals(state)) return "ENCERRADO";
        if ("PAUSED".equals(state)) return "INTERVALO";
        return "PRÓXIMO JOGO";
    }
    private String teamName(JSONObject team) { return team == null ? "A definir" : team.optString("shortName", team.optString("name", "A definir")); }

    private void updateUi(String comp, String scoreText, String stateText) {
        new Handler(Looper.getMainLooper()).post(() -> { competition.setText(comp); score.setText(scoreText); status.setText(stateText); });
        NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE); manager.notify(10, serviceNotification(scoreText));
    }

    private void notifyGoal(String home, int hg, int ag, String away) {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_goaltask).setContentTitle("⚽ GOOOOOL!")
            .setContentText(home+" "+hg+" × "+ag+" "+away).setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true).setDefaults(Notification.DEFAULT_ALL).build();
        ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(99, notification);
    }

    private Notification serviceNotification(String text) {
        PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this,CHANNEL).setSmallIcon(R.drawable.ic_goaltask).setContentTitle("GoalTask ao vivo")
            .setContentText(text).setOngoing(true).setSilent(true).setContentIntent(open).build();
    }
    private void createChannel() {
        NotificationChannel channel=new NotificationChannel(CHANNEL,"Placares e gols",NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Atualizações do placar flutuante e alertas de gol");
        ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
    }
    private int dp(int value) { return Math.round(value*getResources().getDisplayMetrics().density); }
    @Override public int onStartCommand(Intent intent,int flags,int startId) { return START_STICKY; }
    @Override public void onDestroy() {
        running=false; scheduler.shutdownNow(); if (overlay!=null && windowManager!=null) windowManager.removeView(overlay); super.onDestroy();
    }
    @Override public android.os.IBinder onBind(Intent intent) { return null; }
}
