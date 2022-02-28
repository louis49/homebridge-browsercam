# homebridge-browsercam

[![npm-version](https://badgen.net/npm/v/homebridge-browsercam?icon=npm)](https://www.npmjs.com/package/homebridge-browsercam)
[![npm-total-downloads](https://badgen.net/npm/dt/homebridge-browsercam?icon=npm)](https://www.npmjs.com/package/homebridge-browsercam)

[![Donate](https://badgen.net/badge/paypal/donate?icon=https://simpleicons.now.sh/paypal/fff)](https://www.paypal.com/donate/?hosted_button_id=B8NGNPFGK69BY)
[![Donate](https://badgen.net/badge/buymeacoffee/donate?icon=https://simpleicons.now.sh/buymeacoffee/fff)](https://www.buymeacoffee.com/louis49github)

A [Homebridge](https://homebridge.io) plugin enabling HomeKit support for camera with any phones, tablets, laptops, computers : everything that have a camera, a network access and a not too old/crappy browser

*Note that this is an unofficial plugin.*

## Prerequisites

* Plug your phone/laptop/tablet in! :electric_plug:
* Configure it to never sleep
* Configure it to access to local network by Wifi
* Configure it to minimal brightness

Optional : 
* Use a gooseneck clamp holder

## Installation
1. Install Homebridge by following
   [the instructions](https://github.com/homebridge/homebridge/wiki).
2. Install this plugin by running :
```bash
sudo npm install -g --unsafe-perm homebridge-browsercam
```
3. Configure plugin settings in homebridge - restart
4. On your phone/laptop, connect to [https://YOUR_HOMEBRIDGE_IP](https://YOUR_HOMEBRIDGE_IP) - <span style="color:#B93129;font-weight:bold;text-decoration:underline"> 'S' in httpS is MANDATORY.</span>
5. Accept the bad certificate warning (you can't have a real certificate on local networks, see [#configuration](#markdown-header-configuration))
6. Screen goes black when device become available on HomeKit
7. On HomeKit app tap on 'Add accessory'
8. Enjoy ;-)

## Features 
* Snapshoting
* Streaming
* Recording
* Motion Sensor
* Noise Sensor
* Pulse Sensor
* Torch if present become a light switch
* Battery state and level

## Configuration

### SSL Certificate
If your network own a public domain, you can use a signed SSL certificate : 
replace key.pem and cert.pem in .homebridge/browsercam folder and restart

### Devices

* Android : ✓
The best choice for that project, I personally use an old and crappy Huawei

* iPhone : ✓
You can't have 'torch' option : it will be not presented in HomeKit 
You can't have 'battery' information : it will be not presented in HomeKit

* Laptop : ✓
Facing Mode is automatically at 'environment' value, but in this case, "user" value is preferred

### Browsers : 

* Chrome : ✓
* Safari : ✓
* Firefox : ? 
  * Not tested
* IE / Edge : ✗ 
  * Don't open an issue about this please, PR too. Thank you so much

### Standard settings

* Server 
  * port : 443
* H264 codec
  * H264 (H264 OMX available)
* Streaming :
  * buffer : 500 ms
* Recording
  * active : true
  * buffer : 4000 ms
* Motion Sensor 
  * active : true
  * timeout : 30000 ms
  * threshold : 5%
* Noise Sensor
  * active : true
  * timeout : 30000 ms
  * threshold : 30Db
* Pulse Sensor
  * active : true
  * timeout : 30000 ms
  * threshold : 0.12m/s^2

  
### Mac M1
For Homebridge instance on Mac M1, you need to install ffmpeg by following : https://github.com/homebridge/ffmpeg-for-homebridge/issues/30#issuecomment-960181989

# License

MIT
