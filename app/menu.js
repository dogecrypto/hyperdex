'use strict';
const path = require('path');
const electron = require('electron');
const {runJS} = require('electron-util');
const config = require('./config');
const {openGitHubIssue} = require('./util');
const {websiteUrl, repoUrl, appViews} = require('./constants');
const {isDevelopment} = require('./util-common');
const {translate} = require('./locale');

const {app, BrowserWindow, shell, clipboard, ipcMain: ipc, Menu} = electron;
const appName = app.getName();
const t = translate('menu');

const sendAction = (action, data) => {
	const [win] = BrowserWindow.getAllWindows();

	if (process.platform === 'darwin') {
		win.restore();
	}

	win.webContents.send(action, data);
};

const setActiveView = view => {
	sendAction('set-active-view', view);
};

const createHelpMenu = () => {
	const helpSubmenu = [
		{
			label: t('help.website'),
			click() {
				shell.openExternal(websiteUrl);
			},
		},
		{
			label: t('help.sourceCode'),
			click() {
				shell.openExternal(repoUrl);
			},
		},
		{
			label: t('help.reportIssue'),
			click() {
				openGitHubIssue('<!-- Please succinctly describe your issue and steps to reproduce it -->');
			},
		},
	];

	if (process.platform !== 'darwin') {
		helpSubmenu.push({
			type: 'separator',
		}, {
			role: 'about',
			click() {
				electron.dialog.showMessageBox({
					title: t('help.about', {appName}),
					message: `${appName} ${app.getVersion()}`,
					detail: 'Copyright © Luke Childs',
					icon: path.join(__dirname, 'static/icon.png'),
				});
			},
		});
	}

	return helpSubmenu;
};

const createDebugMenu = () => {
	const debugMenu = {
		label: 'Debug',
		submenu: [
			{
				label: 'Log Container State',
				async click() {
					const [win] = BrowserWindow.getAllWindows();
					await runJS('UNSTATED.logState()', win);
				},
			},
			{
				label: 'Toggle Logging on State Changes',
				async click() {
					const [win] = BrowserWindow.getAllWindows();
					await runJS('UNSTATED.logStateChanges = !UNSTATED.logStateChanges', win);
				},
			},
			{
				type: 'separator',
			},
			{
				label: 'Log Swaps',
				async click() {
					const [win] = BrowserWindow.getAllWindows();
					await runJS('_swapDB.getSwaps().then(console.log)', win);
				},
			},
			{
				label: 'Copy Swaps to Clipboard',
				async click() {
					const [win] = BrowserWindow.getAllWindows();
					const swaps = await runJS('_swapDB.getSwaps()', win);
					clipboard.writeText(JSON.stringify(swaps, null, '\t'));
				},
			},
			{
				type: 'separator',
			},
			{
				label: 'Show Portfolios',
				click() {
					shell.openItem(path.join(app.getPath('userData'), 'portfolios'));
				},
			},
			{
				label: 'Show Settings',
				click() {
					config.openInEditor();
				},
			},
			{
				label: 'Show App Data',
				click() {
					shell.openItem(app.getPath('userData'));
				},
			},
			{
				type: 'separator',
			},
			{
				label: 'Delete Swap History',
				async click() {
					const [win] = BrowserWindow.getAllWindows();
					await runJS('_swapDB.destroy()', win);
					app.relaunch();
					app.quit();
				},
			},
			{
				label: 'Delete Portfolios',
				click() {
					const [win] = BrowserWindow.getAllWindows();
					shell.moveItemToTrash(path.join(app.getPath('userData'), 'portfolios'));
					win.webContents.reload();
				},
			},
			{
				label: 'Delete Settings',
				click() {
					config.clear();
					app.relaunch();
					app.quit();
				},
			},
			{
				label: 'Delete App Data',
				click() {
					shell.moveItemToTrash(app.getPath('userData'));
					app.relaunch();
					app.quit();
				},
			},
		],
	};

	return debugMenu;
};

const createAppMenu = options => {
	const {isLoggedIn, activeView} = Object.assign({
		isLoggedIn: false,
		activeView: 'Login',
	}, options);

	const portfolioSubmenu = [];
	for (const [i, view] of appViews.entries()) {
		portfolioSubmenu.push({
			label: t(`portfolio.${view.toLowerCase()}`),
			type: 'radio',
			checked: activeView === view,
			accelerator: `CommandOrControl+${i + 1}`,
			click() {
				setActiveView(view);
			},
		});
	}

	portfolioSubmenu.push(
		{
			type: 'separator',
		},
		{
			label: t('portfolio.goToNextView'),
			accelerator: 'Control+Tab',
			click() {
				sendAction('set-next-view');
			},
		},
		{
			label: t('portfolio.goToPrevView'),
			accelerator: 'Control+Shift+Tab',
			click() {
				sendAction('set-previous-view');
			},
		},
		{
			type: 'separator',
		},
		{
			label: t('portfolio.logOut'),
			click() {
				sendAction('log-out');
			},
		}
	);

	const macosTpl = [
		{
			label: appName,
			submenu: [
				{
					role: 'about',
				},
				{
					type: 'separator',
				},
				{
					label: t('app.preferences'),
					accelerator: 'Cmd+,',
					click() {
						setActiveView('Settings');
					},
				},
				{
					type: 'separator',
				},
				{
					role: 'services',
					submenu: [],
				},
				{
					type: 'separator',
				},
				{
					role: 'hide',
				},
				{
					role: 'hideothers',
				},
				{
					role: 'unhide',
				},
				{
					type: 'separator',
				},
				{
					role: 'quit',
				},
			],
		},
		{
			role: 'editMenu',
		},
		{
			label: t('portfolio.title'),
			visible: isLoggedIn,
			submenu: portfolioSubmenu,
		},
		{
			role: 'window',
			submenu: [
				{
					role: 'minimize',
				},
				{
					role: 'close',
				},
				{
					type: 'separator',
				},
				{
					role: 'front',
				},
				{
					role: 'togglefullscreen',
				},
			],
		},
		{
			role: 'help',
			submenu: createHelpMenu(),
		},
	];

	const otherTpl = [
		{
			label: t('other.file'),
			submenu: [
				{
					role: 'quit',
				},
			],
		},
		{
			role: 'editMenu',
		},
		{
			label: t('portfolio.title'),
			visible: isLoggedIn,
			submenu: portfolioSubmenu,
		},
		{
			role: 'help',
			submenu: createHelpMenu(),
		},
	];

	const tpl = process.platform === 'darwin' ? macosTpl : otherTpl;

	if (isDevelopment) {
		tpl.push(createDebugMenu());
	}

	Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
};

ipc.on('app-container-state-updated', (event, state) => {
	createAppMenu({
		// TODO: Get the logged in state from the container
		isLoggedIn: state.activeView !== 'Login' && state.activeView !== 'AppSettings',
		activeView: state.activeView,
	});
});

module.exports = createAppMenu;
