import { BrowserCam, PLATFORM_NAME } from './platform.js';

export default (api) => {
    api.registerPlatform(PLATFORM_NAME, BrowserCam);
};
