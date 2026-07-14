import { contextBridge } from 'electron';
import { desktopApi } from '@preload/desktopApi';

contextBridge.exposeInMainWorld('desktopApi', desktopApi);
