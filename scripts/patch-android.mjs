/* 给 Capacitor 生成的 Android 工程打补丁：
 * 1. 申请摄像头权限（扫码同步码要用）
 * 2. 允许 WebView 直接使用摄像头（getUserMedia）
 * 找不到对应文本时直接跳过，绝不因为补丁失败而中断构建。
 */
import fs from 'node:fs';
import path from 'node:path';

const android = path.resolve(process.cwd(), 'android');
const manifest = path.join(android, 'app', 'src', 'main', 'AndroidManifest.xml');
const capCfg = path.resolve(process.cwd(), 'capacitor.config.json');

function log(m) { console.log('[patch-android] ' + m); }

if (!fs.existsSync(android)) { log('未找到 android/ 目录，跳过'); process.exit(0); }

/* ---------- 1. AndroidManifest ---------- */
if (fs.existsSync(manifest)) {
  let xml = fs.readFileSync(manifest, 'utf8');
  if (!xml.includes('android.permission.CAMERA')) {
    const perms = [
      '    <uses-permission android:name="android.permission.CAMERA" />',
      '    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
      '    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" ' +
      'android:maxSdkVersion="32" />',
      '    <uses-feature android:name="android.hardware.camera" android:required="false" />',
      '    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />'
    ].join('\n');
    if (xml.includes('<application')) {
      xml = xml.replace('<application', perms + '\n    <application');
    } else {
      xml = xml.replace('</manifest>', perms + '\n</manifest>');
    }
    fs.writeFileSync(manifest, xml);
    log('已注入摄像头 / 读图权限');
  } else {
    log('权限已存在，跳过');
  }
}

/* ---------- 2. MainActivity：放行 getUserMedia ---------- */
let pkg = 'app.jiluya.recorder';
try {
  pkg = JSON.parse(fs.readFileSync(capCfg, 'utf8')).appId || pkg;
} catch (e) { /* 用默认值 */ }

const mainPath = path.join(android, 'app', 'src', 'main', 'java',
  ...pkg.split('.'), 'MainActivity.java');

if (fs.existsSync(mainPath)) {
  let java = fs.readFileSync(mainPath, 'utf8');
  if (!java.includes('onPermissionRequest')) {
    java = java
      .replace(/^(package [\w.]+;)/m,
        '$1\n\nimport android.os.Build;\nimport android.os.Bundle;\n' +
        'import android.webkit.PermissionRequest;\nimport android.webkit.WebChromeClient;')
      .replace(/public class MainActivity extends BridgeActivity\s*\{/,
        'public class MainActivity extends BridgeActivity {\n' +
        '    @Override\n' +
        '    public void onCreate(Bundle savedInstanceState) {\n' +
        '        super.onCreate(savedInstanceState);\n' +
        '        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {\n' +
        '            getBridge().getWebView().setWebChromeClient(new WebChromeClient() {\n' +
        '                @Override\n' +
        '                public void onPermissionRequest(final PermissionRequest request) {\n' +
        '                    request.grant(request.getResources());\n' +
        '                }\n' +
        '            });\n' +
        '        }\n' +
        '    }\n');
    fs.writeFileSync(mainPath, java);
    log('已允许 WebView 使用摄像头');
  } else {
    log('MainActivity 已处理，跳过');
  }
} else {
  log('未找到 MainActivity.java（' + mainPath + '），跳过');
}

log('完成');
