import { app, BrowserWindow, screen, Menu } from 'electron'
import * as path from 'path'
import * as url from 'url'

let mainWindow: BrowserWindow
const args = process.argv.slice(1)
const serve: boolean = args.some(val => val === '--serve')
const dev: boolean = args.some(val => val === '--dev')

function createWindow() {
    const electronScreen = screen
    const size = electronScreen.getPrimaryDisplay().workAreaSize

    // Create the browser window.
    mainWindow = new BrowserWindow({
        title: 'HardwareTester',
        //x: 0,
        //y: 0,
        center: true,
        width: size.width - 50,
        height: size.height - 50,
        resizable: false,
        fullscreenable: false,
        transparent: true,
        // Remove the window frame from windows applications
        frame: false,
        // Hide the titlebar from MacOS applications while keeping the stop lights
        titleBarStyle: 'hiddenInset', // or 'customButtonsOnHover',
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            backgroundThrottling: false,
            disableHtmlFullscreenWindowResize: true,
        },
    })

    if (serve) {
        require('electron-reload')(__dirname, {
            electron: require(`${__dirname}/node_modules/electron`),
        })
        mainWindow.loadURL('http://localhost:4200')
    } else {
        mainWindow.loadURL(
            url.format({
                pathname: path.join(__dirname, 'dist/index.html'),
                protocol: 'file:',
                slashes: true,
            })
        )
    }

    // Open the DevTools.
    if (dev) {
        mainWindow.webContents.openDevTools()
    }

    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
        // Dereference the window object, usually you would store window
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })
}

try {
    // Only one instance is allowed
    if (!app.requestSingleInstanceLock()) {
        console.warn('Sorry, only one instance is allowed. Terminting...')
        mainWindow = null
        app.quit()
    } else {
        app.on('second-instance', (event, commandLine, workingDirectory) => {
            // Someone tried to run a second instance, we should focus our window.
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore()
                mainWindow.focus()
            }
        })

        // This method will be called when Electron has finished
        // initialization and is ready to create browser windows.
        // Some APIs can only be used after this event occurs.
        app.on('ready', () => {
            createWindow()

            const menuTemplate: Electron.MenuItemConstructorOptions[] = [
                {
                    label: app.getName(),
                    submenu: [
                        {
                            label: 'About',
                            click() {
                                mainWindow.webContents.send('openAboutModal', '')
                            },
                        },
                        { type: 'separator' },
                        { role: 'quit' },
                    ],
                },
                {
                    label: 'File',
                    submenu: [{ label: 'Toggle Dev Tools', role: 'toggleDevTools' }],
                },
                {
                    label: 'Edit',
                    submenu: [
                        {
                            label: 'Undo',
                            accelerator: 'CmdOrCtrl+Z',
                            role: 'undo',
                        },
                        {
                            label: 'Redo',
                            accelerator: 'Shift+CmdOrCtrl+Z',
                            role: 'redo',
                        },
                        {
                            type: 'separator',
                        },
                        {
                            label: 'Cut',
                            accelerator: 'CmdOrCtrl+X',
                            role: 'cut',
                        },
                        {
                            label: 'Copy',
                            accelerator: 'CmdOrCtrl+C',
                            role: 'copy',
                        },
                        {
                            label: 'Paste',
                            accelerator: 'CmdOrCtrl+V',
                            role: 'paste',
                        },
                        {
                            label: 'Select All',
                            accelerator: 'CmdOrCtrl+A',
                            role: 'selectAll',
                        },
                    ],
                },
            ]

            const menu = Menu.buildFromTemplate(menuTemplate)
            Menu.setApplicationMenu(menu)
        })

        // Quit when all windows are closed.
        app.on('window-all-closed', () => {
            // On OS X it is common for applications and their menu bar
            // to stay active until the user quits explicitly with Cmd + Q
            if (process.platform !== 'darwin') {
                app.quit()
            }
        })

        app.on('activate', () => {
            // On OS X it's common to re-create a window in the app when the
            // dock icon is clicked and there are no other windows open.
            if (mainWindow === null) {
                createWindow()
            }
        })
    }
} catch (e) {
    // Catch Error
    // throw e;
}
