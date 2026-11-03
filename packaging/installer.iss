; Inno Setup script for the FrameDecks Windows installer.
; The AppId stays the same across the rebrand. Earlier install folders and shortcuts are removed, while data is
; migrated from Kingdom Connect or BSF Command Center on first start (src/legacy.py).
; Build (after PyInstaller):  ISCC.exe /DAppVersion=3.0 packaging\installer.iss
; Installs for the current user only: no administrator permission needed, updates never need it either.

#ifndef AppVersion
  #define AppVersion "0.0"
#endif

[Setup]
; Keep this AppId the same forever, so new versions install over old ones
AppId={{D0EFEBEA-94E5-50C7-A69D-45F04529103B}
AppName=FrameDecks
AppVersion={#AppVersion}
AppVerName=FrameDecks {#AppVersion}
AppPublisher=Shobin Mathews
AppContact=hello@framedecks.com
AppPublisherURL=https://framedecks.com
AppSupportURL=https://framedecks.com/help
AppUpdatesURL=https://framedecks.com/download
AppComments=Proprietary software by Shobin Mathews, free to use under the FrameDecks EULA.
; 7.0: the End User License Agreement (LICENSE = docs/legal/eula.md) is shown and must be accepted; a silent update
; (/VERYSILENT, src/updater.py) accepts it on the person's behalf, as they accepted it when first installing
LicenseFile=..\LICENSE
VersionInfoVersion={#AppVersion}
VersionInfoCompany=Shobin Mathews
VersionInfoDescription=FrameDecks Setup
VersionInfoCopyright=Copyright (C) 2026 Shobin Mathews. All rights reserved.
DefaultDirName={localappdata}\Programs\FRAMEDECKS
UsePreviousAppDir=no
DisableDirPage=yes
DefaultGroupName=FRAMEDECKS
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=FrameDecks v{#AppVersion}
SetupIconFile=framedecks.ico
UninstallDisplayIcon={app}\FRAMEDECKS.exe
UninstallDisplayName=FrameDecks
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
CloseApplications=force
RestartApplications=no

[Tasks]
Name: "desktopicon"; Description: "Create a desktop icon"; GroupDescription: "Icons:"
Name: "vcam"; Description: "Install the FrameDecks vCam for Zoom and Teams (Windows asks for administrator permission)"; GroupDescription: "Options:"
Name: "startup"; Description: "Start FrameDecks automatically when I sign in to Windows"; GroupDescription: "Options:"; Flags: unchecked

[Files]
Source: "..\dist\FRAMEDECKS\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
; remove files left by an older version before copying the new ones
Type: filesandordirs; Name: "{app}\_internal"
; LEGACY (6.9): the program folder and shortcuts of versions published under the program's earlier name
Type: filesandordirs; Name: "{localappdata}\Programs\BSF Command Center"
Type: files; Name: "{autoprograms}\BSF Command Center.lnk"
Type: files; Name: "{autodesktop}\BSF Command Center.lnk"
Type: files; Name: "{userstartup}\BSF Command Center.lnk"
; Remove the previous branded install after the new app has migrated its data.
Type: filesandordirs; Name: "{localappdata}\Programs\Kingdom Connect"
Type: files; Name: "{autoprograms}\Kingdom Connect.lnk"
Type: files; Name: "{autodesktop}\Kingdom Connect.lnk"
Type: files; Name: "{userstartup}\Kingdom Connect.lnk"
; LEGACY: the camera files' earlier names (the camera is registered again from the renamed files)
Type: files; Name: "{app}\_internal\vcam\bin\kingdomconnect_vcam*.dll"
Type: files; Name: "{app}\_internal\vcam\bin\*register-kingdomconnect-camera.cmd"

[Registry]
; 6.11 the website's "Open FrameDecks on this PC" (framedecks://open, docs/architecture/meeting-form.md section 4):
; this user only, removed on uninstall. The program only starts or comes forward; it reads nothing from the link.
Root: HKCU; Subkey: "Software\Classes\framedecks"; ValueType: string; ValueName: ""; ValueData: "URL:FRAMEDECKS"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\framedecks"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\framedecks\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: """{app}\FRAMEDECKS.exe"",0"
Root: HKCU; Subkey: "Software\Classes\framedecks\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\FRAMEDECKS.exe"" ""%1"""

[Icons]
Name: "{autoprograms}\FRAMEDECKS"; Filename: "{app}\FRAMEDECKS.exe"
Name: "{autodesktop}\FRAMEDECKS"; Filename: "{app}\FRAMEDECKS.exe"; Tasks: desktopicon
Name: "{userstartup}\FRAMEDECKS"; Filename: "{app}\FRAMEDECKS.exe"; Tasks: startup

[Run]
Filename: "{app}\_internal\vcam\bin\register-framedecks-camera.cmd"; Verb: "runas"; Flags: shellexec waituntilterminated runhidden; Check: ShouldRegisterCamera; StatusMsg: "Installing the FrameDecks vCam..."
Filename: "{app}\FRAMEDECKS.exe"; Description: "Open FrameDecks now"; Flags: nowait postinstall skipifsilent
; 7.1.1: an update started by FrameDecks itself (/UPDATE=1, src/updater.py) opens the new version when it is done
Filename: "{app}\FRAMEDECKS.exe"; Flags: nowait; Check: IsUpdate

[UninstallRun]
Filename: "{app}\_internal\vcam\bin\unregister-framedecks-camera.cmd"; Verb: "runas"; Flags: shellexec waituntilterminated runhidden; RunOnceId: "RemoveCamera"
Filename: "{sys}\taskkill.exe"; Parameters: "/IM ""FRAMEDECKS.exe"" /F"; Flags: runhidden; RunOnceId: "StopApp"

[Code]
const
  WebView2Key = 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  WebView2KeyUser = 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

function HasWebView2: Boolean;
var v: String;
begin
  Result := (RegQueryStringValue(HKLM, WebView2Key, 'pv', v) and (v <> '') and (v <> '0.0.0.0')) or
            (RegQueryStringValue(HKCU, WebView2KeyUser, 'pv', v) and (v <> '') and (v <> '0.0.0.0'));
end;

// FrameDecks vCam (called FrameRelay before 9.1 and FRAMECAST before 6.12) keeps the camera ID it had as "BCC vCam", so Zoom, Teams
// and OBS see the same device under its new name: registering it again on an update writes the new name into Windows. Its driver file was renamed in 6.4, so a PC that already has the camera registers it again
// (pointing Windows at the new file) even when the option is not ticked this time.
const
  CameraKey = 'CLSID\{6F2B8C3E-4D7A-4B9E-9C11-B5CC0A1E7D21}';

function CameraRegistered: Boolean;
begin
  Result := RegKeyExists(HKCR64, CameraKey) or RegKeyExists(HKCR32, CameraKey);
end;

function ShouldRegisterCamera: Boolean;
begin
  Result := WizardIsTaskSelected('vcam') or CameraRegistered;
end;

// 7.1.1: started by FrameDecks' own updater (/UPDATE=1): FrameDecks closes itself a second after starting this
function IsUpdate: Boolean;
begin
  Result := ExpandConstant('{param:update|0}') = '1';
end;

// LEGACY (6.9): an earlier version still running under the earlier exe name is closed first, so its folder can go
function PrepareToInstall(var NeedsRestart: Boolean): String;
var code: Integer;
begin
  { 7.1.1: give FrameDecks time to close by itself before anything still running is ended }
  if IsUpdate then Sleep(5000);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM "Kingdom Connect.exe" /F', '', SW_HIDE, ewWaitUntilTerminated, code);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM "BSF Command Center.exe" /F', '', SW_HIDE, ewWaitUntilTerminated, code);
  { 6.10: 6.8 and 6.9 could stay running, unseen, after Quit; close such a copy so its files can be replaced }
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM "FRAMEDECKS.exe" /F', '', SW_HIDE, ewWaitUntilTerminated, code);
  Result := '';
end;

function InitializeSetup: Boolean;
begin
  Result := True;
  if not HasWebView2 then
    MsgBox('Microsoft Edge WebView2 (a free Windows component) was not found.' + #13#10 + #13#10 +
           'FrameDecks will still work, but it will open in your web browser instead of its own window.' + #13#10 +
           'To get the app window, install "WebView2 Runtime" from microsoft.com (search "WebView2 Runtime download").',
           mbInformation, MB_OK);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var dataDir: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    dataDir := ExpandConstant('{userappdata}\FRAMEDECKS');
    if DirExists(dataDir) then
      if MsgBox('Also delete your FrameDecks data?' + #13#10 + #13#10 +
                'This includes your saved verses and questions, members, settings and backups in:' + #13#10 + dataDir + #13#10 + #13#10 +
                'Choose No to keep it (recommended if you will install again).',
                mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
        DelTree(dataDir, True, True, True);
  end;
end;
