const { app, BrowserWindow, desktopCapturer, session, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true
  });

  // Menu nativo de seleção de tela com proteção contra travamento
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then(sources => {
      
      let escolhaFeita = false; // Trava de segurança

      const template = sources.map(source => ({
        label: source.name,
        click: () => {
          escolhaFeita = true;
          callback({ video: source, audio: 'loopback' });
        }
      }));
      
      template.push({ type: 'separator' });
      template.push({ 
        label: 'Cancelar', 
        click: () => {
          escolhaFeita = true;
          callback(null);
        } 
      });

      const menu = Menu.buildFromTemplate(template);
      
      // Se o usuário clicar fora do menu, cancela automaticamente e libera o botão
      menu.on('menu-will-close', () => {
        setTimeout(() => {
          if (!escolhaFeita) {
            callback(null);
          }
        }, 100);
      });

      menu.popup();
    });
  });

  // Carrega o arquivo HTML direto da pasta
  mainWindow.loadFile(path.join(__dirname, 'public/index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});