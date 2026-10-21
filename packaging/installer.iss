; Inno Setup script for the FRAMEDECKS Windows installer.
; FRAMEDECKS: the program is FrameDecks.exe in the FrameDecks program folder; the data folder keeps the Kingdom Connect
; name (6.9). The AppId stays the same, so this installs over every earlier version; the old program folders and
; shortcuts are removed, and the app moves data from the earliest name itself on first start (legacy.py).
; Build (after PyInstaller):  ISCC.exe /DAppVersion=3.0 packaging\installer.iss
; Installs for the current user only: no administrator permission needed, updates never need it either.

#ifndef AppVersion
  #define AppVersion "0.0"
#endif

[Setup]
; Keep this AppId the same forever, so new versions install over old ones
AppId={{D0EFEBEA-94E5-50C7-A69D-45F04529103B}
AppName=FRAMEDECKS
AppVersion={#AppVersion}
AppVerName=FRAMEDECKS {#AppVersion}
AppPublisher=Shobin Mathews
AppContact=mshobin@gmail.com
AppSupportURL=mailto:mshobin@gmail.com
AppComments=Independent ministry tool by Shobin Mathews.
VersionInfoVersion={#AppVersion}
VersionInfoCompany=Shobin Mathews
VersionInfoDescription=FRAMEDECKS Setup
VersionInfoCopyright=Copyright (C) Shobin Mathews
DefaultDirName={localappdata}\Programs\FrameDecks
; earlier versions were installed under the program's earlier names: install to the FrameDecks folder instead
UsePreviousAppDir=no
DisableDirPage=yes
DefaultGroupName=Kingdom Connect
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=FrameDecks v{#AppVersion}
SetupIconFile=kingdom-connect.ico
UninstallDisplayIcon={app}\FrameDecks.exe
UninstallDisplayName=FRAMEDECKS
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
CloseApplications=force
RestartApplications=no

[Tasks]
Name: "desktopicon"; Description: "Create a desktop icon"; GroupDescription: "Icons:"
Name: "vcam"; Description: "Install the FrameCast camera for Zoom and Teams (Windows asks for administrator permission)"; GroupDescription: "Options:"
Name: "startup"; Description: "Start FRAMEDECKS automatically when I sign in to Windows"; GroupDescription: "Options:"; Flags: unchecked

[Files]
Source: "..\dist\FrameDecks\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
; remove files left by an older version before copying the new ones
Type: filesandordirs; Name: "{app}\_internal"
; LEGACY (6.9): the program folder and shortcuts of versions published under the program's earlier name
Type: filesandordirs; Name: "{localappdata}\Programs\BSF Command Center"
Type: files; Name: "{autoprograms}\BSF Command Center.lnk"
Type: files; Name: "{autodesktop}\BSF Command Center.lnk"
Type: files; Name: "{userstartup}\BSF Command Center.lnk"
; FRAMEDECKS: the program is FrameDecks.exe in the FrameDecks folder; the shortcuts and the program folder of the
; Kingdom Connect versions go (the camera is registered again from the new folder, see ShouldRegisterCamera)
Type: filesandordirs; Name: "{localappdata}\Programs\Kingdom Connect"
Type: files; Name: "{autoprograms}\Kingdom Connect.lnk"
Type: files; Name: "{autodesktop}\Kingdom Connect.lnk"
Type: files; Name: "{userstartup}\Kingdom Connect.lnk"

[Icons]
Name: "{autoprograms}\FRAMEDECKS"; Filename: "{app}\FrameDecks.exe"
Name: "{autodesktop}\FRAMEDECKS"; Filename: "{app}\FrameDecks.exe"; Tasks: desktopicon
Name: "{userstartup}\FRAMEDECKS"; Filename: "{app}\FrameDecks.exe"; Tasks: startup

[Run]
Filename: "{app}\_internal\vcam\bin\register-kingdomconnect-camera.cmd"; Verb: "runas"; Flags: shellexec waituntilterminated runhidden; Check: ShouldRegisterCamera; StatusMsg: "Installing the FrameCast camera..."
Filename: "{app}\FrameDecks.exe"; Description: "Open FRAMEDECKS now"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\_internal\vcam\bin\unregister-kingdomconnect-camera.cmd"; Verb: "runas"; Flags: shellexec waituntilterminated runhidden; RunOnceId: "RemoveKingdomConnectCamera"
Filename: "{sys}\taskkill.exe"; Parameters: "/IM ""FrameDecks.exe"" /F"; Flags: runhidden; RunOnceId: "StopApp"

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

// The FrameCast camera keeps the camera ID it had as "BCC vCam", so Zoom, Teams and OBS see the same device
// under its new name. Its driver file was renamed in 6.4, so a PC that already has the camera registers it again
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

// LEGACY: a version still running under an earlier exe name is closed first, so its folder can go
function PrepareToInstall(var NeedsRestart: Boolean): String;
var code: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM "BSF Command Center.exe" /F', '', SW_HIDE, ewWaitUntilTerminated, code);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM "Kingdom Connect.exe" /F', '', SW_HIDE, ewWaitUntilTerminated, code);   // FRAMEDECKS: the exe before
  Result := '';
end;

function InitializeSetup: Boolean;
begin
  Result := True;
  if not HasWebView2 then
    MsgBox('Microsoft Edge WebView2 (a free Windows component) was not found.' + #13#10 + #13#10 +
           'FRAMEDECKS will still work, but it will open in your web browser instead of its own window.' + #13#10 +
           'To get the app window, install "WebView2 Runtime" from microsoft.com (search "WebView2 Runtime download").',
           mbInformation, MB_OK);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var dataDir: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    dataDir := ExpandConstant('{userappdata}\Kingdom Connect');
    if DirExists(dataDir) then
      if MsgBox('Also delete your FRAMEDECKS data?' + #13#10 + #13#10 +
                'This includes your saved verses and questions, members, settings and backups in:' + #13#10 + dataDir + #13#10 + #13#10 +
                'Choose No to keep it (recommended if you will install again).',
                mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
        DelTree(dataDir, True, True, True);
  end;
end;
