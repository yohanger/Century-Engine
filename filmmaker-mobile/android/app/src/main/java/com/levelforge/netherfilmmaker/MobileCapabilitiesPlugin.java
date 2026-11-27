package com.levelforge.netherfilmmaker;

import android.Manifest;
import android.app.ActivityManager;
import android.content.Context;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.annotation.ActivityCallback;
import java.io.ByteArrayOutputStream;
import java.io.File;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.webkit.WebView;


import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.ar.core.ArCoreApk;

import java.util.List;
import org.json.JSONException;

/** Capacidades del teléfono: diagnóstico, referencias visuales y orientación remota. No procesa la escena 3D. */
@CapacitorPlugin(name = "MobileCapabilities", permissions = {
    @Permission(alias = "camera", strings = { Manifest.permission.CAMERA })
})
public class MobileCapabilitiesPlugin extends Plugin {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private SensorManager sensorManager;
    private SensorEventListener activeSensorListener;
    private Runnable sensorTimeout;
    private PluginCall sensorCall;
    private SensorEventListener remoteOrientationListener;
    private ArPoseProbe activePoseProbe;
    private File visualReferenceFile;

    @PluginMethod
    public void inventory(PluginCall call) {
        JSObject result = new JSObject();
        result.put("source", "android-native");
        result.put("manufacturer", Build.MANUFACTURER);
        result.put("model", Build.MODEL);
        result.put("device", Build.DEVICE);
        result.put("softwareBuild", Build.DISPLAY);
        result.put("androidRelease", Build.VERSION.RELEASE);
        result.put("sdkInt", Build.VERSION.SDK_INT);
        try {
            result.put("appVersion", getContext().getPackageManager()
                .getPackageInfo(getContext().getPackageName(), 0).versionName);
        } catch (Exception error) {
            result.put("appVersion", "unavailable");
        }
        result.put("webViewVersion", Build.VERSION.SDK_INT < 26 || WebView.getCurrentWebViewPackage() == null
            ? "not-available" : WebView.getCurrentWebViewPackage().versionName);
        result.put("cameraPermission", getPermissionState("camera").toString());

        ActivityManager manager = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        if (manager != null) {
            ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
            manager.getMemoryInfo(memory);
            result.put("physicalRamBytesReportedByOs", memory.totalMem);
            result.put("availableRamBytesAtScan", memory.availMem);
        }

        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        JSArray sensors = new JSArray();
        if (sensorManager != null) {
            List<Sensor> available = sensorManager.getSensorList(Sensor.TYPE_ALL);
            for (Sensor sensor : available) {
                JSObject item = new JSObject();
                item.put("type", sensor.getType());
                item.put("stringType", sensor.getStringType());
                item.put("name", sensor.getName());
                item.put("vendor", sensor.getVendor());
                item.put("maxRange", sensor.getMaximumRange());
                item.put("resolution", sensor.getResolution());
                sensors.put(item);
            }
        }
        result.put("sensors", sensors);
        JSArray cameras = new JSArray();
        CameraManager cameraManager = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
        if (cameraManager != null) {
            try {
                for (String id : cameraManager.getCameraIdList()) {
                    CameraCharacteristics data = cameraManager.getCameraCharacteristics(id);
                    JSObject item = new JSObject();
                    item.put("id", id);
                    Integer facing = data.get(CameraCharacteristics.LENS_FACING);
                    item.put("facing", facing == null ? "unknown" : facing == CameraCharacteristics.LENS_FACING_BACK
                        ? "back" : facing == CameraCharacteristics.LENS_FACING_FRONT ? "front" : "external");
                    cameras.put(item);
                }
            } catch (Exception error) {
                result.put("cameraEnumerationError", error.getClass().getSimpleName());
            }
        }
        result.put("cameras", cameras);
        result.put("arCameraFeature", getContext().getPackageManager().hasSystemFeature("android.hardware.camera.ar"));
        call.resolve(result);
    }

    @PluginMethod
    public void requestCamera(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("cameraPermission", "GRANTED");
            call.resolve(result);
        } else {
            requestPermissionForAlias("camera", call, "cameraPermissionResult");
        }
    }

    @PermissionCallback
    private void cameraPermissionResult(PluginCall call) {
        JSObject result = new JSObject();
        result.put("cameraPermission", getPermissionState("camera").toString());
        call.resolve(result);
    }

    @PluginMethod
    public void arAvailability(PluginCall call) {
        try {
            ArCoreApk.getInstance().checkAvailabilityAsync(getContext(), availability -> {
                JSObject result = new JSObject();
                result.put("availability", availability.name());
                result.put("supportedByService", availability.isSupported());
                result.put("sessionTested", false);
                call.resolve(result);
            });
        } catch (Exception error) {
            JSObject result = new JSObject();
            result.put("availability", "CHECK_ERROR");
            result.put("reason", error.getClass().getSimpleName());
            result.put("sessionTested", false);
            call.resolve(result);
        }
    }

    @PluginMethod
    public void installArService(PluginCall call) {
        // requestInstall puede abrir un diálogo de Android; requiere hilo principal.
        getActivity().runOnUiThread(() -> {
            try {
                ArCoreApk.Availability state = ArCoreApk.getInstance().checkAvailability(getContext());
                if (!state.isSupported()) {
                    call.reject("ARCore no ha confirmado compatibilidad: " + state.name());
                    return;
                }
                ArCoreApk.InstallStatus install = ArCoreApk.getInstance().requestInstall(getActivity(), true);
                JSObject result = new JSObject();
                result.put("installStatus", install.name());
                call.resolve(result);
            } catch (Exception error) {
                call.reject("No fue posible iniciar la instalación ARCore: " + error.getClass().getSimpleName());
            }
        });
    }

    // Metadatos de cámara sensor: NO son directamente la calibración del JPEG procesado.
    @PluginMethod
    public void rearCameraOptics(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            call.reject("Debes conceder permiso de cámara antes de consultar su óptica");
            return;
        }
        CameraManager manager = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
        if (manager == null) {
            call.reject("CameraManager no disponible");
            return;
        }
        try {
            for (String cameraId : manager.getCameraIdList()) {
                CameraCharacteristics data = manager.getCameraCharacteristics(cameraId);
                Integer facing = data.get(CameraCharacteristics.LENS_FACING);
                if (facing == null || facing != CameraCharacteristics.LENS_FACING_BACK) continue;
                JSObject result = new JSObject();
                result.put("cameraId", cameraId);
                result.put("facing", "back");
                result.put("coordinateFrame", "android-camera-sensor-active-array");
                result.put("applicableToProcessedJpeg", false);
                float[] intrinsic = data.get(CameraCharacteristics.LENS_INTRINSIC_CALIBRATION);
                result.put("intrinsicsReported", intrinsic != null && intrinsic.length == 5);
                if (intrinsic != null && intrinsic.length == 5) {
                    JSArray components = new JSArray();
                    for (float value : intrinsic) components.put((double) value);
                    result.put("intrinsicsFxFyCxCySkew", components);
                }
                result.put("distortionReported", data.get(CameraCharacteristics.LENS_DISTORTION) != null);
                call.resolve(result);
                return;
            }
            call.reject("No se identificó una cámara trasera");
        } catch (Exception error) {
            call.reject("No se pudo consultar la óptica trasera: " + error.getClass().getSimpleName());
        }
    }

    // Un disparo por acción del usuario. Se emplea la cámara nativa del sistema;
    // el intento solicita lente trasera, pero Android/OEM puede ignorar esa preferencia.
    @PluginMethod
    public void captureVisualReference(PluginCall call) {
        if (visualReferenceFile != null) {
            call.reject("Ya existe una captura de referencia en curso");
            return;
        }
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            call.reject("Primero debes conceder el permiso de cámara");
            return;
        }
        try {
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            File target = File.createTempFile("lf_s01a_reference_", ".jpg", getContext().getCacheDir());
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", target);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            intent.setClipData(ClipData.newRawUri("lf-reference", uri));
            intent.putExtra("android.intent.extras.CAMERA_FACING", 0);
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            visualReferenceFile = target;
            startActivityForResult(call, intent, "visualReferenceResult");
        } catch (Exception error) {
            clearVisualReferenceFile();
            call.reject("No se pudo abrir la cámara: " + error.getClass().getSimpleName());
        }
    }

    @ActivityCallback
    private void visualReferenceResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            clearVisualReferenceFile();
            return;
        }
        File original = visualReferenceFile;
        try {
            if (result.getResultCode() != android.app.Activity.RESULT_OK || original == null || original.length() == 0) {
                call.reject("La captura fue cancelada o no devolvió una fotografía");
                return;
            }
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(original.getAbsolutePath(), bounds);
            if (bounds.outWidth < 1 || bounds.outHeight < 1) {
                call.reject("El archivo capturado no contiene una imagen válida");
                return;
            }
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = 1;
            while (Math.max(bounds.outWidth / options.inSampleSize, bounds.outHeight / options.inSampleSize) > 1600)
                options.inSampleSize *= 2;
            Bitmap bitmap = BitmapFactory.decodeFile(original.getAbsolutePath(), options);
            if (bitmap == null) {
                call.reject("No pudo decodificarse la imagen de cámara");
                return;
            }
            int orientation = new ExifInterface(original.getAbsolutePath()).getAttributeInt(
                ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            Matrix transform = new Matrix();
            if (orientation == ExifInterface.ORIENTATION_ROTATE_90) transform.postRotate(90);
            else if (orientation == ExifInterface.ORIENTATION_ROTATE_180) transform.postRotate(180);
            else if (orientation == ExifInterface.ORIENTATION_ROTATE_270) transform.postRotate(270);
            else if (orientation == ExifInterface.ORIENTATION_FLIP_HORIZONTAL) transform.postScale(-1, 1);
            else if (orientation == ExifInterface.ORIENTATION_FLIP_VERTICAL) transform.postScale(1, -1);
            else if (orientation == ExifInterface.ORIENTATION_TRANSPOSE || orientation == ExifInterface.ORIENTATION_TRANSVERSE)
                throw new IllegalArgumentException("Orientación EXIF no admitida para medir poses");
            if (!transform.isIdentity()) {
                Bitmap rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), transform, true);
                if (rotated != bitmap) bitmap.recycle();
                bitmap = rotated;
            }
            ByteArrayOutputStream stream = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 80, stream);
            if (stream.size() > 1_200_000) {
                stream.reset();
                bitmap.compress(Bitmap.CompressFormat.JPEG, 60, stream);
            }
            int width = bitmap.getWidth();
            int height = bitmap.getHeight();
            bitmap.recycle();
            if (stream.size() > 1_200_000) {
                call.reject("La fotografía excede el límite de tamaño para el diagnóstico");
                return;
            }
            JSObject evidence = new JSObject();
            evidence.put("source", "android-native-camera-intent");
            evidence.put("rearLensRequested", true);
            evidence.put("rearLensVerified", false);
            evidence.put("captureTimestampSystemMsApprox", System.currentTimeMillis());
            evidence.put("timestampIsShutterTime", false);
            evidence.put("width", width);
            evidence.put("height", height);
            evidence.put("imageBytes", stream.size());
            ActivityManager manager = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
            if (manager != null) {
                ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
                manager.getMemoryInfo(memory);
                evidence.put("availableRamBytesAfterCapture", memory.availMem);
            }
            evidence.put("mime", "image/jpeg");
            evidence.put("imageBase64", Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP));
            call.resolve(evidence);
        } catch (Exception error) {
            call.reject("No se pudo leer la fotografía: " + error.getClass().getSimpleName());
        } finally {
            clearVisualReferenceFile();
        }
    }

    private void clearVisualReferenceFile() {
        if (visualReferenceFile != null) visualReferenceFile.delete();
        visualReferenceFile = null;
    }

    @PluginMethod
    public void sampleOrientation(PluginCall call) {
        if (sensorCall != null || remoteOrientationListener != null) {
            call.reject("Existe una muestra de sensores activa");
            return;
        }
        if (sensorManager == null) sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager == null) {
            call.reject("SensorManager no disponible");
            return;
        }
        Sensor sensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        if (sensor == null) sensor = sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR);
        if (sensor == null) {
            call.reject("No hay sensor de vector de rotación (ni GAME_ROTATION_VECTOR)");
            return;
        }
        int durationMs = Math.max(1000, Math.min(8000, call.getInt("durationMs", 4000)));
        final int sourceType = sensor.getType();
        JSArray samples = new JSArray();
        final long begun = SystemClock.elapsedRealtimeNanos();
        final long[] lastSample = {0L};
        sensorCall = call;
        activeSensorListener = new SensorEventListener() {
            @Override public void onSensorChanged(SensorEvent event) {
                if (event.timestamp - lastSample[0] < 100_000_000L) return;
                lastSample[0] = event.timestamp;
                float[] q = new float[4]; // Android: w,x,y,z
                SensorManager.getQuaternionFromVector(q, event.values);
                JSObject item = new JSObject();
                item.put("elapsedMs", (event.timestamp - begun) / 1_000_000.0);
                JSArray values = new JSArray();
                try {
                    for (double coordinate : new double[]{q[1], q[2], q[3], q[0]}) values.put(coordinate);
                } catch (JSONException error) {
                    PluginCall pending = sensorCall;
                    clearSensors();
                    if (pending != null) pending.reject("El sensor devolvió una orientación no serializable");
                    return;
                }
                item.put("quaternionXYZW", values);
                samples.put(item);
            }
            @Override public void onAccuracyChanged(Sensor ignored, int accuracy) { }
        };
        if (!sensorManager.registerListener(activeSensorListener, sensor, SensorManager.SENSOR_DELAY_GAME, handler)) {
            clearSensors();
            call.reject("El sensor existe, pero no pudo activarse");
            return;
        }
        sensorTimeout = () -> {
            clearSensors();
            JSObject result = new JSObject();
            result.put("source", "android-rotation-vector-3dof");
            result.put("coordinateFrame", "android-sensor-device-frame-raw");
            result.put("sensorType", sourceType);
            result.put("durationMs", durationMs);
            result.put("samples", samples);
            result.put("hasTranslation", false);
            call.resolve(result);
        };
        handler.postDelayed(sensorTimeout, durationMs);
    }

    // S03: recursos del proceso de la app y RAM del dispositivo. Muestreo bajo demanda.
    @PluginMethod
    public void monitorResources(PluginCall call) {
        JSObject result = new JSObject();
        result.put("cpuTimeMs", android.os.Process.getElapsedCpuTime());
        result.put("elapsedMs", SystemClock.elapsedRealtime());
        ActivityManager manager = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        if (manager != null) {
            android.os.Debug.MemoryInfo[] processes = manager.getProcessMemoryInfo(new int[]{android.os.Process.myPid()});
            if (processes != null && processes.length > 0) result.put("processPssMiB", processes[0].getTotalPss() / 1024.0);
            ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
            manager.getMemoryInfo(memory);
            result.put("availableSystemMiB", memory.availMem / 1048576.0);
        }
        call.resolve(result);
    }

    // S02: orientación continua de 3DoF. No hay coordenadas ni acceso a la escena del PC.
    @PluginMethod
    public void startRemoteOrientation(PluginCall call) {
        if (sensorCall != null || remoteOrientationListener != null) {
            call.reject("Otro lector del sensor está activo");
            return;
        }
        if (sensorManager == null) sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager == null) { call.reject("SensorManager no disponible"); return; }
        Sensor sensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        if (sensor == null) sensor = sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR);
        if (sensor == null) { call.reject("Vector de rotación no disponible"); return; }
        final int type = sensor.getType();
        final long[] lastTime = {0L};
        remoteOrientationListener = new SensorEventListener() {
            @Override public void onSensorChanged(SensorEvent event) {
                if (event.timestamp - lastTime[0] < 50_000_000L) return;
                lastTime[0] = event.timestamp;
                float[] q = new float[4];
                SensorManager.getQuaternionFromVector(q, event.values);
                if (!Float.isFinite(q[0]) || !Float.isFinite(q[1]) || !Float.isFinite(q[2]) || !Float.isFinite(q[3])) return;
                JSArray values = new JSArray();
                try { for (double coordinate : new double[]{q[1], q[2], q[3], q[0]}) values.put(coordinate); }
                catch (JSONException error) { return; }
                JSObject sample = new JSObject();
                sample.put("sensorType", type);
                sample.put("timestampNs", event.timestamp);
                sample.put("quaternionXYZW", values);
                notifyListeners("remoteOrientation", sample);
            }
            @Override public void onAccuracyChanged(Sensor ignored, int accuracy) { }
        };
        if (!sensorManager.registerListener(remoteOrientationListener, sensor, SensorManager.SENSOR_DELAY_GAME, handler)) {
            stopRemoteSensor();
            call.reject("Android rechazó el sensor para previsualización");
            return;
        }
        JSObject result = new JSObject();
        result.put("source", "android-rotation-vector-3dof");
        result.put("sensorType", type);
        result.put("hasTranslation", false);
        call.resolve(result);
    }

    @PluginMethod
    public void stopRemoteOrientation(PluginCall call) {
        stopRemoteSensor();
        call.resolve();
    }

    private void stopRemoteSensor() {
        if (sensorManager != null && remoteOrientationListener != null) sensorManager.unregisterListener(remoteOrientationListener);
        remoteOrientationListener = null;
    }

    @PluginMethod
    public void probeArPose(PluginCall call) {
        if (activePoseProbe != null) {
            call.reject("Ya existe una prueba AR activa");
            return;
        }
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            call.reject("Primero debes conceder el permiso de cámara");
            return;
        }
        try {
            ArCoreApk.Availability availability = ArCoreApk.getInstance().checkAvailability(getContext());
            if (availability != ArCoreApk.Availability.SUPPORTED_INSTALLED) {
                call.reject("ARCore no está confirmado como instalado y compatible: " + availability.name());
                return;
            }
            int durationMs = Math.max(1500, Math.min(8000, call.getInt("durationMs", 5000)));
            activePoseProbe = new ArPoseProbe(getActivity(), handler, durationMs, new ArPoseProbe.Callback() {
                @Override public void completed(JSObject result) {
                    activePoseProbe = null;
                    call.resolve(result);
                }
                @Override public void failed(String message) {
                    activePoseProbe = null;
                    call.reject(message);
                }
            });
            ArPoseProbe probe = activePoseProbe;
            getActivity().runOnUiThread(() -> {
                try { probe.start(); }
                catch (Exception error) { probe.cancel("No se pudo iniciar la sesión AR: " + error.getClass().getSimpleName()); }
            });
        } catch (Exception error) {
            activePoseProbe = null;
            call.reject("No se pudo preparar la sesión AR: " + error.getClass().getSimpleName());
        }
    }

    private void clearSensors() {
        if (sensorTimeout != null) handler.removeCallbacks(sensorTimeout);
        if (sensorManager != null && activeSensorListener != null) sensorManager.unregisterListener(activeSensorListener);
        sensorTimeout = null;
        activeSensorListener = null;
        sensorCall = null;
    }

    // El navegador puede suspender el proceso al cambiar de app o apagar la pantalla.
    @Override protected void handleOnPause() {
        if (sensorCall != null) sensorCall.reject("Prueba interrumpida al suspender la aplicación");
        clearSensors();
        stopRemoteSensor();
        if (activePoseProbe != null) activePoseProbe.cancel("Prueba interrumpida al suspender la aplicación");
        super.handleOnPause();
    }

    @Override protected void handleOnDestroy() {
        clearVisualReferenceFile();
        clearSensors();
        stopRemoteSensor();
        if (activePoseProbe != null) activePoseProbe.cancel("Aplicación cerrada");
        super.handleOnDestroy();
    }
}
