#!/usr/bin/env python3
"""Classify genuine compiled artifacts. A JS export is not a native binary/runtime proof."""
import hashlib,json,os,plistlib,shutil,subprocess,sys,zipfile
from pathlib import Path
if os.environ.get('GITHUB_ACTIONS')!='true':raise RuntimeError('Native build classification belongs in GitHub Actions')
platform=sys.argv[1];output=Path('test-results/mobile-native')/platform;output.mkdir(parents=True,exist_ok=True)
proof={'platform':platform,'commit':os.environ['GITHUB_SHA'],'compiled':True,'runtime_verified':False,'store_distribution':False,'synthetic_only':True}
if platform=='android':
 apk=Path('mobile/android/app/build/outputs/apk/release/app-release.apk');assert apk.is_file()
 with zipfile.ZipFile(apk) as archive:
  names=archive.namelist();assert 'AndroidManifest.xml' in names and any(n.endswith('.dex') for n in names) and 'assets/index.android.bundle' in names
  arches=sorted({n.split('/')[1] for n in names if n.startswith('lib/') and n.endswith('.so')});assert {'arm64-v8a','x86_64'}<=set(arches)
 target=output/'mon-enfant-parent-development.apk';shutil.copyfile(apk,target);proof.update({'native_architectures':arches,'embedded_js':True,'signing':'generated-template debug signing, not store credentials','sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
elif platform=='ios':
 apps=list((Path(os.environ['RUNNER_TEMP'])/'mon-enfant-ios-build/Build/Products/Release-iphonesimulator').glob('*.app'));assert len(apps)==1
 app=apps[0];assert (app/'Info.plist').is_file() and (app/'main.jsbundle').is_file()
 signed=subprocess.run(['codesign','-d','--entitlements',':-',str(app)],capture_output=True,check=True)
 entitlements=plistlib.loads(signed.stdout)
 assert entitlements.get('application-identifier','').endswith('app.monenfant.parent')
 subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True)
 subprocess.run(['ditto','-c','-k','--sequesterRsrc','--keepParent',str(app),str(output/'mon-enfant-parent-simulator.zip')],check=True)
 proof.update({'target':'iOS Simulator','distribution_certificate_used':False,'embedded_js':True,'signing':'local simulator ad-hoc identity, no Apple account or certificate','keychain_application_entitlement_verified':True})
else:raise RuntimeError('Unsupported native target')
(output/'build-proof.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
