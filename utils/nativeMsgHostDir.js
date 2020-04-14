import path, { dirname, join } from 'path'
import isDev from 'electron-is-dev'
import appRootPath from '@zap/utils/appRootPath'
import { platform } from 'os'

/**
 * nativeMsgHostName - Get the OS specific native messaging host install script.
 *
 * @returns {string} 'install.sh' on mac or linux, 'install.bat' on windows.
 */
const nativeMsgHostName = () => (platform() === 'win32' ? 'install.bat' : 'install.sh')

/**
 * nativeMsgHostDir - Get the OS specific path to the native messaging binary for handling
 * communication with browser extension.
 *
 * @returns {string} Path to the native messaging install script
 */
const nativeMsgHostDir = () => {
  //   console.log(join(dirname(path.resolve('resources')), 'nativeMsgHost', nativeMsgHostName()))
  //   console.log(
  //     join(appRootPath(), 'resources', 'nativeMsgHost', 'nativeMsgHost', nativeMsgHostName())
  //   )
  return isDev
    ? join(
        dirname(path.resolve('resources', 'nativeMsgHost')),
        'nativeMsgHost',
        nativeMsgHostName()
      )
    : join(appRootPath(), 'resources', 'nativeMsgHost', nativeMsgHostName())
}

export default nativeMsgHostDir
