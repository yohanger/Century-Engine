package com.levelforge.netherfilmmaker;

import android.app.Activity;
import android.opengl.GLES11Ext;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.os.Handler;
import android.os.SystemClock;
import android.view.Gravity;
import android.widget.FrameLayout;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.google.ar.core.Camera;
import com.google.ar.core.Frame;
import com.google.ar.core.Pose;
import com.google.ar.core.Session;
import com.google.ar.core.TrackingState;

import java.util.concurrent.atomic.AtomicBoolean;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/** Sesión ARCore temporal: captura evidencia de pose sin dibujar ni grabar vídeo. */
final class ArPoseProbe implements GLSurfaceView.Renderer {
    interface Callback {
        void completed(JSObject result);
        void failed(String message);
    }

    private final Activity activity;
    private final Handler handler;
    private final int durationMs;
    private final Callback callback;
    private final AtomicBoolean finished = new AtomicBoolean(false);
    private final JSArray samples = new JSArray();
    private Session session;
    private GLSurfaceView surface;
    private Runnable deadline;
    private volatile boolean running;
    private long startedMs;
    private long lastFrameMs;
    private int trackingFrames;
    private int pausedFrames;
    private String failure = "";

    ArPoseProbe(Activity activity, Handler handler, int durationMs, Callback callback) {
        this.activity = activity;
        this.handler = handler;
        this.durationMs = durationMs;
        this.callback = callback;
    }

    void start() throws Exception {
        // Crear Session es una comprobación real, no una afirmación basada en el catálogo.
        session = new Session(activity);
        surface = new GLSurfaceView(activity);
        surface.setEGLContextClientVersion(2);
        surface.setRenderer(this);
        surface.setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(8, 8, Gravity.BOTTOM | Gravity.END);
        activity.addContentView(surface, params);
        startedMs = SystemClock.elapsedRealtime();
        session.resume();
        running = true;
        surface.onResume();
        deadline = () -> stop(null);
        handler.postDelayed(deadline, durationMs);
    }

    @Override public void onSurfaceCreated(GL10 gl, EGLConfig config) {
        if (finished.get() || session == null) return;
        int[] textures = new int[1];
        GLES20.glGenTextures(1, textures, 0);
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textures[0]);
        if (textures[0] == 0) {
            handler.post(() -> stop("No se pudo crear la textura de cámara para ARCore"));
            return;
        }
        session.setCameraTextureName(textures[0]);
    }

    @Override public void onSurfaceChanged(GL10 gl, int width, int height) {
        if (session != null && !finished.get()) session.setDisplayGeometry(
            activity.getWindowManager().getDefaultDisplay().getRotation(), Math.max(1, width), Math.max(1, height));
    }

    @Override public void onDrawFrame(GL10 gl) {
        if (!running || finished.get() || session == null) return;
        try {
            Frame frame = session.update();
            Camera camera = frame.getCamera();
            TrackingState state = camera.getTrackingState();
            if (state == TrackingState.TRACKING) trackingFrames++;
            else pausedFrames++;
            long now = SystemClock.elapsedRealtime();
            if (now - lastFrameMs < 100 || samples.length() >= 60) return;
            lastFrameMs = now;
            Pose pose = camera.getPose();
            float[] t = pose.getTranslation();
            float[] q = pose.getRotationQuaternion(); // ARCore: x,y,z,w; sistema local en metros
            JSObject item = new JSObject();
            item.put("elapsedMs", now - startedMs);
            item.put("trackingState", state.name());
            JSArray position = new JSArray();
            for (double value : new double[]{t[0], t[1], t[2]}) position.put(value);
            JSArray rotation = new JSArray();
            for (double value : new double[]{q[0], q[1], q[2], q[3]}) rotation.put(value);
            item.put("positionMeters", position);
            item.put("quaternionXYZW", rotation);
            samples.put(item);
        } catch (Exception error) {
            failure = error.getClass().getSimpleName();
            handler.post(() -> stop("ARCore update falló: " + failure));
        }
    }

    void cancel(String reason) { handler.post(() -> stop(reason)); }

    private void stop(String error) {
        if (!finished.compareAndSet(false, true)) return;
        running = false;
        if (deadline != null) handler.removeCallbacks(deadline);
        if (surface != null) {
            surface.onPause();
            if (surface.getParent() instanceof android.view.ViewGroup) {
                ((android.view.ViewGroup) surface.getParent()).removeView(surface);
            }
        }
        if (session != null) {
            try { session.pause(); } catch (Exception ignored) { }
            try { session.close(); } catch (Exception ignored) { }
        }
        session = null;
        surface = null;
        if (error != null) { callback.failed(error); return; }
        JSObject result = new JSObject();
        result.put("source", "arcore-session-live");
        result.put("referenceFrame", "arcore-local-session");
        result.put("units", "meters");
        result.put("durationMs", durationMs);
        result.put("trackingFrames", trackingFrames);
        result.put("nonTrackingFrames", pausedFrames);
        result.put("samples", samples);
        result.put("hasMeasuredPosition", trackingFrames > 0 && samples.length() > 0);
        result.put("isProductionTracking", false);
        callback.completed(result);
    }
}
