// ==UserScript==
// @name         RES for Old Reddit
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  A retractable sidebar and a dark theme for Old Reddit, with settings.
// @author       You & Gemini
// @match        https://old.reddit.com/*
// @resource     DARK_THEME https://github.com/SysAdminDoc/Reddit_Enhancement_Suite_2.0/raw/refs/heads/main/themes/darkmode.css
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_getResourceText
// @downloadURL  https://update.greasyfork.org/scripts/xxxx/RES-for-Old-Reddit.user.js
// @updateURL    https://update.greasyfork.org/scripts/xxxx/RES-for-Old-Reddit.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. CONFIGURATION & CONSTANTS ---
    const SIDEBAR_WIDTH = '310px';
    const HANDLE_WIDTH = '30px';

    // --- 2. UI & STYLE INJECTION ---

    /**
     * Injects all necessary CSS for the script's functionality, including the settings modal.
     */
    function injectBaseStyles() {
        GM_addStyle(`
            /* --- Settings Cog & Modal --- */
            .res-settings-cog {
                font-size: 20px;
                cursor: pointer;
                margin-left: 8px;
                line-height: 1;
                font-weight: bold;
                color: var(--text-normal, #369);
                text-decoration: none !important;
            }
            .res-settings-cog:hover {
                color: var(--text-normal-hover, #4ac);
            }
            .res-modal-overlay {
                display: none;
                position: fixed;
                z-index: 1001;
                left: 0; top: 0;
                width: 100%; height: 100%;
                background-color: rgba(0,0,0,0.6);
                backdrop-filter: blur(4px);
            }
            .res-modal-content {
                position: relative;
                background-color: #f4f4f4;
                margin: 10% auto;
                padding: 20px;
                border: 1px solid #888;
                border-radius: 8px;
                width: 90%;
                max-width: 500px;
                color: #111;
            }
            .res-modal-header {
                padding-bottom: 10px;
                border-bottom: 1px solid #ccc;
                font-size: 1.5em;
                margin-bottom: 20px;
            }
            .res-modal-close {
                color: #aaa;
                float: right;
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
            }
            .res-setting-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            /* Dark mode styles for the modal */
            body.res-dark-mode-active .res-modal-content {
                 background-color: var(--gray-1, #232323);
                 color: var(--text-normal, #eee);
                 border-color: var(--gray-3, #454545);
            }
            body.res-dark-mode-active .res-modal-header {
                 border-bottom-color: var(--gray-3, #454545);
            }
        `);
    }

    /**
     * Creates and injects the settings cog icon and the settings modal HTML into the page.
     */
    function createSettingsPanel() {
        // Create and inject cog icon
        const headerRight = document.getElementById('header-bottom-right');
        if (headerRight) {
            const settingsCog = document.createElement('a');
            settingsCog.href = 'javascript:void(0)';
            settingsCog.className = 'res-settings-cog';
            settingsCog.innerHTML = '⚙️';
            settingsCog.title = 'RES for Old Reddit Settings';
            headerRight.appendChild(settingsCog);
            settingsCog.addEventListener('click', () => {
                document.getElementById('res-modal-overlay').style.display = 'block';
            });
        }

        // Create and inject modal HTML
        const modalHTML = `
            <div id="res-modal-overlay" class="res-modal-overlay">
                <div class="res-modal-content">
                    <span id="res-modal-close" class="res-modal-close">&times;</span>
                    <div class="res-modal-header">RES for Old Reddit Settings</div>
                    <div class="res-setting-row">
                        <label for="res-setting-sidebar">Enable Retractable Sidebar</label>
                        <input type="checkbox" id="res-setting-sidebar">
                    </div>
                    <div class="res-setting-row">
                        <label for="res-setting-darkmode">Enable Dark Mode</label>
                        <input type="checkbox" id="res-setting-darkmode">
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add event listeners for modal
        document.getElementById('res-modal-close').addEventListener('click', () => {
            document.getElementById('res-modal-overlay').style.display = 'none';
        });
        document.getElementById('res-modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'res-modal-overlay') {
                e.target.style.display = 'none';
            }
        });

        // Add event listeners for settings toggles
        document.getElementById('res-setting-sidebar').addEventListener('change', (e) => {
            GM_setValue('res_sidebar_enabled', e.target.checked);
            applySettings();
        });
        document.getElementById('res-setting-darkmode').addEventListener('change', (e) => {
            GM_setValue('res_darkmode_enabled', e.target.checked);
            applySettings();
        });
    }


    // --- 3. FEATURE INITIALIZATION & MANAGEMENT ---

    /**
     * Initializes the retractable sidebar functionality.
     */
    function initializeSidebar() {
        const sidebar = document.querySelector('div.side');
        const content = document.querySelector('div.content');
        const header = document.getElementById('header');

        if (!sidebar || !content || sidebar.classList.contains('res-initialized')) {
            return; // Already initialized or elements not found
        }
        sidebar.classList.add('res-initialized');

        const headerHeight = header ? header.offsetHeight : 50;

        GM_addStyle(`
            /* Sidebar functionality styles */
            body.res-sidebar-active .content { transition: margin-right 0.35s ease-in-out; }
            body.res-sidebar-active .side {
                position: fixed !important; top: ${headerHeight}px !important; right: 0;
                width: ${SIDEBAR_WIDTH}; height: calc(100vh - ${headerHeight}px) !important;
                z-index: 999; transition: transform 0.35s ease-in-out;
                box-shadow: -5px 0 15px rgba(0,0,0,0.2);
                transform: translateX(calc(100% - ${HANDLE_WIDTH}));
                display: flex !important; padding: 0 !important; margin: 0 !important;
            }
            body.res-sidebar-locked .side { transform: translateX(0) !important; }
            .res-sidebar-handle {
                width: ${HANDLE_WIDTH}; height: 100%; background-color: #333;
                box-shadow: inset -2px 0 5px rgba(0,0,0,0.4); display: flex;
                align-items: center; justify-content: center; cursor: pointer;
                flex-shrink: 0; position: relative;
            }
            .res-sidebar-handle svg { color: white; width: 24px; height: 24px; transition: transform 0.3s ease; }
            body.res-sidebar-locked .res-sidebar-handle svg { transform: rotate(180deg); }
            .res-content-wrapper {
                flex-grow: 1; width: 0; height: 100%; overflow-y: auto;
                background-color: #F6F7F8; padding: 16px;
            }
        `);

        const chevronIconSVG = `<svg class="res-chevron-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>`;
        const handle = document.createElement('div');
        handle.className = 'res-sidebar-handle';
        handle.innerHTML = chevronIconSVG;

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'res-content-wrapper';
        while (sidebar.firstChild) {
            contentWrapper.appendChild(sidebar.firstChild);
        }
        sidebar.appendChild(contentWrapper);
        sidebar.prepend(handle);

        handle.addEventListener('click', () => {
            GM_setValue('res_sidebar_locked', !GM_getValue('res_sidebar_locked', false));
            applySidebarState();
        });

        document.body.classList.add('res-sidebar-active');
        applySidebarState(); // Apply initial state
    }

    /**
     * Removes the sidebar functionality and restores original layout.
     */
    function destroySidebar() {
        const sidebar = document.querySelector('div.side.res-initialized');
        if (!sidebar) return;

        document.body.classList.remove('res-sidebar-active', 'res-sidebar-locked');
        document.querySelector('div.content').style.marginRight = ''; // Reset margin

        const handle = sidebar.querySelector('.res-sidebar-handle');
        const contentWrapper = sidebar.querySelector('.res-content-wrapper');

        if (contentWrapper) {
            while (contentWrapper.firstChild) {
                sidebar.appendChild(contentWrapper.firstChild);
            }
            contentWrapper.remove();
        }
        if (handle) handle.remove();

        sidebar.style = ''; // Clear all inline styles
        sidebar.classList.remove('res-initialized');
    }

    /**
     * Applies the correct state for the sidebar (locked/unlocked).
     */
    function applySidebarState() {
         const content = document.querySelector('div.content');
         if (!content || !document.body.classList.contains('res-sidebar-active')) return;

         const isLocked = GM_getValue('res_sidebar_locked', false);
         document.body.classList.toggle('res-sidebar-locked', isLocked);
         content.style.marginRight = isLocked ? SIDEBAR_WIDTH : HANDLE_WIDTH;
    }


    /**
     * Main function to apply all settings based on saved values.
     */
    function applySettings() {
        // Load settings from storage into the modal checkboxes
        document.getElementById('res-setting-sidebar').checked = GM_getValue('res_sidebar_enabled', true);
        document.getElementById('res-setting-darkmode').checked = GM_getValue('res_darkmode_enabled', false);

        // Apply/remove sidebar feature
        if (GM_getValue('res_sidebar_enabled', true)) {
            initializeSidebar();
        } else {
            destroySidebar();
        }

        // Apply/remove dark mode
        const darkStyleTag = document.getElementById('res-dark-theme');
        if (GM_getValue('res_darkmode_enabled', false)) {
            document.body.classList.add('res-dark-mode-active');
            // Only add the style tag if it doesn't already exist
            if (!darkStyleTag) {
                let darkThemeCSS = GM_getResourceText('DARK_THEME');
                // Append the user-specified style for the sidebar wrapper
                darkThemeCSS += `
                    div.res-content-wrapper {
                        background-color: #666666 !important;
                    }
                `;
                GM_addStyle(darkThemeCSS, 'res-dark-theme');
            }
        } else {
            document.body.classList.remove('res-dark-mode-active');
            if (darkStyleTag) {
                darkStyleTag.remove();
            }
        }
    }


    // --- 4. INITIALIZATION ---
    function init() {
        injectBaseStyles();
        createSettingsPanel();
        applySettings();
    }

    // Run the script
    init();

})();
