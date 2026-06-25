class ClickGUI extends UI {
    constructor(config = {}) {
        super({
            win: config.win,
            canvasId: 'mop-engine-clickgui',
        });

        this.moduleManager = config.moduleManager;
        this.onVisibilityChange = typeof config.onVisibilityChange === 'function'
            ? config.onVisibilityChange
            : null;
        if (!(this.moduleManager instanceof ModuleManager)) {
            throw new Error('ClickGUI requires a ModuleManager instance.');
        }

        this.visible = false;
        this.dragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.sliderDrag = null;
        this.textInput = null;
        this.openSelector = null;
        this.mouse = { x: 0, y: 0, down: false };
        this.edgeGrabSize = 10;
        this.selectedCategory = Category.COMBAT;
        this.selectedModule = null;
        this.panel = {
            x: 96,
            y: 72,
            width: 760,
            height: 500,
        };
        this.theme = Object.freeze({
            panel: '#08111d',
            panelBorder: '#1d3651',
            leftPanel: '#0d1726',
            rightPanel: '#0b1421',
            leftTab: '#122033',
            leftTabActive: '#1f3856',
            moduleEnabled: '#6ee7b7',
            moduleDisabled: '#f87171',
            accent: '#7dd3fc',
            text: '#e6edf7',
            mutedText: '#96a7bd',
            field: '#101826',
            fieldBorder: '#31455f',
            sliderTrack: '#223246',
            sliderFill: '#7dd3fc',
            edgeHint: 'rgba(125, 211, 252, 0.16)',
        });

        this.boundKeyDown = this.handleKeyDown.bind(this);
        this.boundMouseMove = this.handleMouseMove.bind(this);
        this.boundMouseDown = this.handleMouseDown.bind(this);
        this.boundMouseUp = this.handleMouseUp.bind(this);

        this.ensureSelectedModule();
    }

    setVisible(visible) {
        const nextVisible = Boolean(visible);
        const previousVisible = this.visible;
        if (previousVisible === nextVisible) {
            return this.visible;
        }

        super.setVisible(nextVisible);

        if (typeof this.onVisibilityChange === 'function') {
            this.onVisibilityChange(this.visible, previousVisible);
        }

        return this.visible;
    }

    onAttach() {
        document.addEventListener('keydown', this.boundKeyDown, true);
        document.addEventListener('mousemove', this.boundMouseMove, true);
        document.addEventListener('mousedown', this.boundMouseDown, true);
        document.addEventListener('mouseup', this.boundMouseUp, true);
    }

    onDestroy() {
        document.removeEventListener('keydown', this.boundKeyDown, true);
        document.removeEventListener('mousemove', this.boundMouseMove, true);
        document.removeEventListener('mousedown', this.boundMouseDown, true);
        document.removeEventListener('mouseup', this.boundMouseUp, true);
    }

    onResize() {
        this.clampPanelToViewport();
    }

    clampPanelToViewport() {
        const maxX = Math.max(16, this.win.innerWidth - this.panel.width - 16);
        const maxY = Math.max(16, this.win.innerHeight - this.panel.height - 16);
        this.panel.x = RenderUtil.clamp(this.panel.x, 16, maxX);
        this.panel.y = RenderUtil.clamp(this.panel.y, 16, maxY);
    }

    handleKeyDown(event) {
        if (!this.visible) {
            return;
        }

        if (this.handleTextInputKey(event)) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    handleMouseMove(event) {
        this.mouse.x = event.clientX;
        this.mouse.y = event.clientY;

        if (!this.visible) {
            return;
        }

        if (this.dragging) {
            this.panel.x = event.clientX - this.dragOffsetX;
            this.panel.y = event.clientY - this.dragOffsetY;
            this.clampPanelToViewport();
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        if (this.sliderDrag) {
            this.updateSliderFromPointer(this.sliderDrag.setting, event.clientX, this.sliderDrag.handle);
            event.preventDefault();
            event.stopPropagation();
        }
    }

    handleMouseDown(event) {
        if (!this.visible || event.button !== 0) {
            return;
        }

        this.mouse.down = true;
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        const panelRect = this.getPanelRect();
        const layout = this.getLayout();
        const interaction = this.findInteraction(mouseX, mouseY);

        if (!RenderUtil.pointInRect(mouseX, mouseY, panelRect) && !interaction) {
            this.textInput = null;
            this.openSelector = null;
            return;
        }

        if (RenderUtil.pointInRect(mouseX, mouseY, layout.headerRect)) {
            this.textInput = null;
            this.openSelector = null;
            this.dragging = true;
            this.dragOffsetX = mouseX - this.panel.x;
            this.dragOffsetY = mouseY - this.panel.y;
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        const edge = this.getDragEdge(mouseX, mouseY, panelRect);
        if (edge) {
            this.textInput = null;
            this.openSelector = null;
            this.dragging = true;
            this.dragOffsetX = mouseX - this.panel.x;
            this.dragOffsetY = mouseY - this.panel.y;
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        if (!interaction) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.runInteraction(interaction, mouseX);
    }

    handleMouseUp(event) {
        if (this.dragging || this.sliderDrag) {
            event.preventDefault();
            event.stopPropagation();
        }

        this.mouse.down = false;
        this.dragging = false;
        this.sliderDrag = null;
    }

    getPanelRect() {
        return {
            x: this.panel.x,
            y: this.panel.y,
            width: this.panel.width,
            height: this.panel.height,
        };
    }

    getLayout() {
        const panelRect = this.getPanelRect();
        const headerHeight = 40;
        const leftWidth = 250;
        const categoryHeight = 36;

        return {
            panelRect,
            headerRect: {
                x: panelRect.x,
                y: panelRect.y,
                width: panelRect.width,
                height: headerHeight,
            },
            leftRect: {
                x: panelRect.x,
                y: panelRect.y + headerHeight,
                width: leftWidth,
                height: panelRect.height - headerHeight,
            },
            rightRect: {
                x: panelRect.x + leftWidth,
                y: panelRect.y + headerHeight,
                width: panelRect.width - leftWidth,
                height: panelRect.height - headerHeight,
            },
            categoryHeight,
            moduleStartY: panelRect.y + headerHeight + categoryHeight + 10,
        };
    }

    getDragEdge(mouseX, mouseY, rect) {
        const size = this.edgeGrabSize;
        const left = mouseX >= rect.x && mouseX <= rect.x + size;
        const right = mouseX >= rect.x + rect.width - size && mouseX <= rect.x + rect.width;
        const top = mouseY >= rect.y && mouseY <= rect.y + size;
        const bottom = mouseY >= rect.y + rect.height - size && mouseY <= rect.y + rect.height;
        return left || right || top || bottom;
    }

    getCategories() {
        return Object.values(Category);
    }

    ensureSelectedModule() {
        const modules = this.moduleManager.getModulesByCategory(this.selectedCategory);
        if (!modules.length) {
            this.selectedModule = null;
            return;
        }

        if (!this.selectedModule || this.selectedModule.category !== this.selectedCategory) {
            this.selectedModule = modules[0];
            return;
        }

        if (!modules.includes(this.selectedModule)) {
            this.selectedModule = modules[0];
        }
    }

    setCategory(category) {
        this.selectedCategory = category;
        this.openSelector = null;
        this.textInput = null;
        this.ensureSelectedModule();
    }

    findInteraction(mouseX, mouseY) {
        const layout = this.getLayout();
        const categories = this.getCategories();
        const categoryWidth = (layout.leftRect.width - 24) / categories.length;

        for (let index = 0; index < categories.length; index += 1) {
            const rect = {
                x: layout.leftRect.x + 12 + index * categoryWidth,
                y: layout.leftRect.y + 10,
                width: categoryWidth - 6,
                height: layout.categoryHeight - 8,
            };

            if (RenderUtil.pointInRect(mouseX, mouseY, rect)) {
                return { type: 'category', category: categories[index] };
            }
        }

        const modules = this.moduleManager.getModulesByCategory(this.selectedCategory);
        for (let index = 0; index < modules.length; index += 1) {
            const itemY = layout.moduleStartY + index * 50;
            const itemRect = {
                x: layout.leftRect.x + 12,
                y: itemY,
                width: layout.leftRect.width - 24,
                height: 42,
            };
            const toggleRect = {
                x: itemRect.x + itemRect.width - 42,
                y: itemRect.y + 9,
                width: 30,
                height: 24,
            };

            if (RenderUtil.pointInRect(mouseX, mouseY, toggleRect)) {
                return { type: 'toggleModule', module: modules[index] };
            }

            if (RenderUtil.pointInRect(mouseX, mouseY, itemRect)) {
                return { type: 'module', module: modules[index] };
            }
        }

        if (!this.selectedModule) {
            return null;
        }

        const settingsLayout = this.getSettingRects(layout.rightRect, this.selectedModule.getSettings());
        for (let index = 0; index < settingsLayout.length; index += 1) {
            const item = settingsLayout[index];
            if (item.type === 'selector' && item.optionRects) {
                for (let optionIndex = 0; optionIndex < item.optionRects.length; optionIndex += 1) {
                    const optionRect = item.optionRects[optionIndex];
                    if (RenderUtil.pointInRect(mouseX, mouseY, optionRect)) {
                        return {
                            type: 'selectorOption',
                            setting: item.setting,
                            value: optionRect.option,
                        };
                    }
                }
            }

            if (!RenderUtil.pointInRect(mouseX, mouseY, item.rowRect)) {
                continue;
            }

            if (item.type === 'boolean') {
                return { type: 'booleanSetting', setting: item.setting };
            }

            if (item.type === 'string') {
                return { type: 'stringSetting', setting: item.setting };
            }

            if (item.type === 'selector') {
                return { type: 'selectorSetting', setting: item.setting };
            }

            if (item.type === 'number') {
                if (RenderUtil.pointInRect(mouseX, mouseY, item.minusRect)) {
                    return { type: 'numberSettingAdjust', setting: item.setting, delta: -1 };
                }
                if (RenderUtil.pointInRect(mouseX, mouseY, item.plusRect)) {
                    return { type: 'numberSettingAdjust', setting: item.setting, delta: 1 };
                }
                return { type: 'numberSettingPrompt', setting: item.setting };
            }

            if (item.type === 'slider') {
                if (RenderUtil.pointInRect(mouseX, mouseY, item.minInputRect)) {
                    return { type: 'sliderSettingPrompt', setting: item.setting, handle: 'min' };
                }
                if (RenderUtil.pointInRect(mouseX, mouseY, item.maxInputRect)) {
                    return { type: 'sliderSettingPrompt', setting: item.setting, handle: 'max' };
                }
                if (RenderUtil.pointInRect(mouseX, mouseY, item.trackRect)) {
                    const value = item.setting.getValue();
                    const minHandleX = item.trackRect.x + ((value[0] - item.setting.min) / (item.setting.max - item.setting.min)) * item.trackRect.width;
                    const maxHandleX = item.trackRect.x + ((value[1] - item.setting.min) / (item.setting.max - item.setting.min)) * item.trackRect.width;
                    const handle = Math.abs(mouseX - minHandleX) <= Math.abs(mouseX - maxHandleX) ? 'min' : 'max';
                    return { type: 'sliderSetting', setting: item.setting, handle };
                }
            }
        }

        return null;
    }

    runInteraction(interaction, mouseX) {
        switch (interaction.type) {
            case 'category':
                this.setCategory(interaction.category);
                break;
            case 'module':
                this.openSelector = null;
                this.textInput = null;
                this.selectedModule = interaction.module;
                break;
            case 'toggleModule':
                this.openSelector = null;
                interaction.module.toggle();
                this.selectedModule = interaction.module;
                break;
            case 'booleanSetting':
                this.openSelector = null;
                interaction.setting.setValue(!interaction.setting.getValue());
                break;
            case 'stringSetting':
                this.beginTextInput(interaction.setting, 'string');
                break;
            case 'numberSettingAdjust':
                this.adjustNumberSetting(interaction.setting, interaction.delta);
                break;
            case 'numberSettingPrompt':
                this.beginTextInput(interaction.setting, 'number');
                break;
            case 'sliderSettingPrompt':
                this.beginTextInput(interaction.setting, `slider-${interaction.handle}`);
                break;
            case 'selectorSetting':
                this.toggleSelector(interaction.setting);
                break;
            case 'selectorOption':
                this.setSelectorValue(interaction.setting, interaction.value);
                break;
            case 'sliderSetting':
                this.openSelector = null;
                this.sliderDrag = {
                    setting: interaction.setting,
                    handle: interaction.handle,
                };
                this.updateSliderFromPointer(interaction.setting, mouseX, interaction.handle);
                break;
            default:
                break;
        }
    }

    beginTextInput(setting, kind) {
        this.openSelector = null;
        let initialValue = String(setting.getValue());
        if (kind === 'slider-min') {
            initialValue = String(setting.getValue()[0]);
        } else if (kind === 'slider-max') {
            initialValue = String(setting.getValue()[1]);
        }
        this.textInput = {
            setting,
            kind,
            value: initialValue,
        };
    }

    commitTextInput() {
        if (!this.textInput) {
            return;
        }

        const { setting, kind, value } = this.textInput;
        try {
            if (kind === 'number') {
                const numericValue = Number(value);
                if (!Number.isFinite(numericValue)) {
                    return;
                }

                setting.setValue(numericValue);
            } else if (kind === 'slider-min' || kind === 'slider-max') {
                const numericValue = Number(value);
                if (!Number.isFinite(numericValue)) {
                    return;
                }

                const currentValue = setting.getValue().slice();
                if (kind === 'slider-min') {
                    currentValue[0] = numericValue;
                } else {
                    currentValue[1] = numericValue;
                }
                setting.setValue(currentValue);
            } else {
                setting.setValue(value);
            }
        } catch (error) {
            console.warn(`ClickGUI: failed to commit ${kind} setting "${setting.name}"`, error);
        } finally {
            this.textInput = null;
        }
    }

    handleTextInputKey(event) {
        if (!this.visible || !this.textInput) {
            return false;
        }

        if (event.code === 'Enter') {
            this.commitTextInput();
            return true;
        }

        if (event.code === 'Escape') {
            this.textInput = null;
            return true;
        }

        if (event.code === 'Backspace') {
            this.textInput.value = this.textInput.value.slice(0, -1);
            return true;
        }

        if (!event.key || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
            return false;
        }

        if ((this.textInput.kind === 'number' || this.textInput.kind === 'slider-min' || this.textInput.kind === 'slider-max') && !/[0-9.-]/.test(event.key)) {
            return true;
        }

        this.textInput.value += event.key;
        return true;
    }

    adjustNumberSetting(setting, delta) {
        const nextValue = setting.getValue() + delta;
        try {
            setting.setValue(RenderUtil.clamp(nextValue, setting.min, setting.max));
        } catch (error) {
            console.warn(`ClickGUI: failed to adjust number setting "${setting.name}"`, error);
        }
    }

    toggleSelector(setting) {
        this.textInput = null;
        this.openSelector = this.openSelector === setting ? null : setting;
    }

    setSelectorValue(setting, value) {
        try {
            setting.setValue(value);
        } catch (error) {
            console.warn(`ClickGUI: failed to update selector setting "${setting.name}"`, error);
        } finally {
            this.openSelector = null;
        }
    }

    updateSliderFromPointer(setting, mouseX, handle) {
        const layout = this.getLayout();
        const settingRects = this.getSettingRects(layout.rightRect, this.selectedModule.getSettings());
        const target = settingRects.find((entry) => entry.setting === setting);
        if (!target || !Number.isFinite(setting.min) || !Number.isFinite(setting.max) || setting.max <= setting.min) {
            return;
        }

        const percent = RenderUtil.clamp((mouseX - target.trackRect.x) / target.trackRect.width, 0, 1);
        const rawValue = setting.min + percent * (setting.max - setting.min);
        const current = setting.getValue().slice();

        if (handle === 'min') {
            current[0] = Math.min(rawValue, current[1]);
        } else {
            current[1] = Math.max(rawValue, current[0]);
        }

        try {
            setting.setValue(current.map((value) => Math.round(value)));
        } catch (error) {
            console.warn(`ClickGUI: failed to update slider setting "${setting.name}"`, error);
        }
    }

    getSelectorFieldWidth(setting, rowRect) {
        const minWidth = 120;
        const maxWidth = Math.max(minWidth, rowRect.width - 180);
        if (!this.ctx) {
            return Math.min(maxWidth, 180);
        }

        const options = Array.isArray(setting.options) ? setting.options.slice() : [];
        options.push(setting.getValue());
        const longestWidth = options.reduce((width, option) => {
            const metrics = FontUtil.measureText(this.ctx, String(option), {
                size: 13,
                weight: '700',
            });
            return Math.max(width, metrics.width);
        }, 0);

        return RenderUtil.clamp(Math.ceil(longestWidth + 34), minWidth, maxWidth);
    }

    getSettingTextMaxWidth(item) {
        const paddingLeft = 14;
        const paddingRight = 14;
        const labelX = item.rowRect.x + paddingLeft;
        let contentRightX = item.rowRect.x + item.rowRect.width - paddingRight;

        if (item.fieldRect) {
            contentRightX = item.fieldRect.x - 14;
        } else if (item.inputRect) {
            contentRightX = item.inputRect.x - 14;
        } else if (item.trackRect) {
            contentRightX = item.trackRect.x - 14;
        } else if (item.toggleRect) {
            contentRightX = item.toggleRect.x - 14;
        }

        return Math.max(40, contentRightX - labelX);
    }

    getSettingRects(rightRect, settings) {
        const rows = [];
        let y = rightRect.y + 76;
        for (let index = 0; index < settings.length; index += 1) {
            const setting = settings[index];
            const rowRect = {
                x: rightRect.x + 20,
                y,
                width: rightRect.width - 40,
                height: 62,
            };
            const item = {
                setting,
                rowRect,
            };

            if (setting instanceof BooleanSetting) {
                item.type = 'boolean';
                item.toggleRect = {
                    x: rowRect.x + rowRect.width - 58,
                    y: rowRect.y + 19,
                    width: 22,
                    height: 22,
                };
            } else if (setting instanceof StringSetting) {
                item.type = 'string';
                item.inputRect = {
                    x: rowRect.x + 210,
                    y: rowRect.y + 16,
                    width: rowRect.width - 226,
                    height: 28,
                };
            } else if (setting instanceof SliderSetting) {
                item.type = 'slider';
                item.trackRect = {
                    x: rowRect.x + 210,
                    y: rowRect.y + 38,
                    width: rowRect.width - 320,
                    height: 8,
                };
                item.minInputRect = {
                    x: rowRect.x + rowRect.width - 110,
                    y: rowRect.y + 12,
                    width: 40,
                    height: 18,
                };
                item.maxInputRect = {
                    x: rowRect.x + rowRect.width - 56,
                    y: rowRect.y + 12,
                    width: 40,
                    height: 18,
                };
                item.rangeSeparatorX = rowRect.x + rowRect.width - 63;
                item.trackRect.width = Math.max(60, item.minInputRect.x - item.trackRect.x - 24);
            } else if (setting instanceof SelectorSetting) {
                item.type = 'selector';
                const fieldWidth = this.getSelectorFieldWidth(setting, rowRect);
                item.fieldRect = {
                    x: rowRect.x + rowRect.width - 16 - fieldWidth,
                    y: rowRect.y + 16,
                    width: fieldWidth,
                    height: 28,
                };
                if (this.openSelector === setting) {
                    item.optionRects = setting.options.map((option, optionIndex) => ({
                        option,
                        x: item.fieldRect.x,
                        y: item.fieldRect.y + item.fieldRect.height + 6 + optionIndex * 30,
                        width: item.fieldRect.width,
                        height: 26,
                    }));
                }
            } else if (setting instanceof NumberSetting) {
                item.type = 'number';
                item.inputRect = {
                    x: rowRect.x + rowRect.width - 160,
                    y: rowRect.y + 16,
                    width: 46,
                    height: 28,
                };
                item.minusRect = {
                    x: rowRect.x + rowRect.width - 108,
                    y: rowRect.y + 17,
                    width: 28,
                    height: 28,
                };
                item.plusRect = {
                    x: rowRect.x + rowRect.width - 40,
                    y: rowRect.y + 17,
                    width: 28,
                    height: 28,
                };
            }

            rows.push(item);
            y += 70;
        }

        return rows;
    }

    drawPanel(layout) {
        const hoveredEdge = this.visible && this.getDragEdge(this.mouse.x, this.mouse.y, layout.panelRect);
        RenderUtil.fillRoundedRect(this.ctx, layout.panelRect.x, layout.panelRect.y, layout.panelRect.width, layout.panelRect.height, 16, this.theme.panel);
        RenderUtil.strokeRoundedRect(this.ctx, layout.panelRect.x, layout.panelRect.y, layout.panelRect.width, layout.panelRect.height, 16, this.theme.panelBorder, 2);
        RenderUtil.fillRoundedRect(this.ctx, layout.leftRect.x, layout.leftRect.y, layout.leftRect.width, layout.leftRect.height, 0, this.theme.leftPanel);
        RenderUtil.fillRoundedRect(this.ctx, layout.rightRect.x, layout.rightRect.y, layout.rightRect.width, layout.rightRect.height, 0, this.theme.rightPanel);

        if (hoveredEdge) {
            RenderUtil.strokeRoundedRect(this.ctx, layout.panelRect.x, layout.panelRect.y, layout.panelRect.width, layout.panelRect.height, 16, this.theme.edgeHint, this.edgeGrabSize);
        }

        RenderUtil.drawText(this.ctx, 'MopEngine ClickGUI', layout.panelRect.x + 18, layout.panelRect.y + 20, {
            size: 18,
            weight: '700',
            color: this.theme.text,
        });
        RenderUtil.drawText(this.ctx, 'Use the ClickGUI bind to toggle • drag from header or edges', layout.panelRect.x + layout.panelRect.width - 18, layout.panelRect.y + 20, {
            size: 12,
            weight: '500',
            color: this.theme.mutedText,
            align: 'right',
        });
    }

    drawCategories(layout) {
        const categories = this.getCategories();
        const categoryWidth = (layout.leftRect.width - 24) / categories.length;
        for (let index = 0; index < categories.length; index += 1) {
            const category = categories[index];
            const active = category === this.selectedCategory;
            const rect = {
                x: layout.leftRect.x + 12 + index * categoryWidth,
                y: layout.leftRect.y + 10,
                width: categoryWidth - 6,
                height: layout.categoryHeight - 8,
            };

            RenderUtil.fillRoundedRect(this.ctx, rect.x, rect.y, rect.width, rect.height, 10, active ? this.theme.leftTabActive : this.theme.leftTab);
            RenderUtil.drawText(this.ctx, category, rect.x + rect.width / 2, rect.y + rect.height / 2, {
                size: 12,
                weight: active ? '700' : '500',
                color: active ? this.theme.text : this.theme.mutedText,
                align: 'center',
            });
        }
    }

    drawModules(layout) {
        const modules = this.moduleManager.getModulesByCategory(this.selectedCategory);
        for (let index = 0; index < modules.length; index += 1) {
            const module = modules[index];
            const selected = module === this.selectedModule;
            const itemY = layout.moduleStartY + index * 50;
            const rect = {
                x: layout.leftRect.x + 12,
                y: itemY,
                width: layout.leftRect.width - 24,
                height: 42,
            };
            const toggleRect = {
                x: rect.x + rect.width - 42,
                y: rect.y + 9,
                width: 30,
                height: 24,
            };

            RenderUtil.fillRoundedRect(this.ctx, rect.x, rect.y, rect.width, rect.height, 10, selected ? this.theme.leftTabActive : this.theme.leftTab);
            RenderUtil.drawText(this.ctx, module.name, rect.x + 12, rect.y + 17, {
                size: 13,
                weight: selected ? '700' : '600',
                color: this.theme.text,
            });
            RenderUtil.drawText(this.ctx, module.description || 'No description', rect.x + 12, rect.y + 30, {
                size: 11,
                color: this.theme.mutedText,
            });

            RenderUtil.fillRoundedRect(this.ctx, toggleRect.x, toggleRect.y, toggleRect.width, toggleRect.height, 12, module.enabled ? '#123b31' : '#3d1720');
            RenderUtil.strokeRoundedRect(this.ctx, toggleRect.x, toggleRect.y, toggleRect.width, toggleRect.height, 12, module.enabled ? this.theme.moduleEnabled : this.theme.moduleDisabled, 1);
            RenderUtil.drawText(this.ctx, module.enabled ? 'ON' : 'OFF', toggleRect.x + toggleRect.width / 2, toggleRect.y + toggleRect.height / 2, {
                size: 10,
                weight: '700',
                color: module.enabled ? this.theme.moduleEnabled : this.theme.moduleDisabled,
                align: 'center',
            });
        }
    }

    drawSettings(layout) {
        if (!this.selectedModule) {
            return;
        }

        RenderUtil.drawText(this.ctx, this.selectedModule.name, layout.rightRect.x + 20, layout.rightRect.y + 28, {
            size: 22,
            weight: '700',
            color: this.theme.text,
        });
        RenderUtil.drawText(this.ctx, `${this.selectedModule.category} module`, layout.rightRect.x + 20, layout.rightRect.y + 52, {
            size: 12,
            color: this.theme.mutedText,
        });

        const settingRects = this.getSettingRects(layout.rightRect, this.selectedModule.getSettings());
        for (let index = 0; index < settingRects.length; index += 1) {
            const item = settingRects[index];
            const setting = item.setting;
            const textMaxWidth = this.getSettingTextMaxWidth(item);
            RenderUtil.fillRoundedRect(this.ctx, item.rowRect.x, item.rowRect.y, item.rowRect.width, item.rowRect.height, 12, this.theme.field);
            RenderUtil.strokeRoundedRect(this.ctx, item.rowRect.x, item.rowRect.y, item.rowRect.width, item.rowRect.height, 12, this.theme.fieldBorder, 1);
            RenderUtil.drawText(this.ctx, FontUtil.trimTextToWidth(this.ctx, setting.name, textMaxWidth, {
                size: 14,
                weight: '700',
            }), item.rowRect.x + 14, item.rowRect.y + 18, {
                size: 14,
                weight: '700',
                color: this.theme.text,
            });
            RenderUtil.drawText(this.ctx, FontUtil.trimTextToWidth(this.ctx, setting.description || 'No description', textMaxWidth, {
                size: 11,
            }), item.rowRect.x + 14, item.rowRect.y + 40, {
                size: 11,
                color: this.theme.mutedText,
            });

            if (item.type === 'boolean') {
                RenderUtil.drawCheckbox(this.ctx, item.toggleRect, setting.getValue(), {
                    backgroundColor: this.theme.leftPanel,
                    borderColor: this.theme.fieldBorder,
                    checkColor: this.theme.moduleEnabled,
                });
            } else if (item.type === 'string') {
                const active = this.textInput && this.textInput.setting === setting;
                const displayValue = active ? this.textInput.value : String(setting.getValue());
                RenderUtil.fillRoundedRect(this.ctx, item.inputRect.x, item.inputRect.y, item.inputRect.width, item.inputRect.height, 8, this.theme.leftPanel);
                RenderUtil.strokeRoundedRect(this.ctx, item.inputRect.x, item.inputRect.y, item.inputRect.width, item.inputRect.height, 8, active ? this.theme.accent : this.theme.fieldBorder, 1);
                RenderUtil.drawText(this.ctx, FontUtil.trimTextToWidth(this.ctx, displayValue, item.inputRect.width - 12, { size: 13, weight: '600' }), item.inputRect.x + 6, item.inputRect.y + item.inputRect.height / 2, {
                    size: 13,
                    weight: '600',
                    color: this.theme.accent,
                });
            } else if (item.type === 'number') {
                const active = this.textInput && this.textInput.setting === setting;
                const displayValue = active ? this.textInput.value : String(setting.getValue());
                RenderUtil.fillRoundedRect(this.ctx, item.inputRect.x, item.inputRect.y, item.inputRect.width, item.inputRect.height, 8, this.theme.leftPanel);
                RenderUtil.strokeRoundedRect(this.ctx, item.inputRect.x, item.inputRect.y, item.inputRect.width, item.inputRect.height, 8, active ? this.theme.accent : this.theme.fieldBorder, 1);
                RenderUtil.fillRoundedRect(this.ctx, item.minusRect.x, item.minusRect.y, item.minusRect.width, item.minusRect.height, 8, this.theme.leftPanel);
                RenderUtil.fillRoundedRect(this.ctx, item.plusRect.x, item.plusRect.y, item.plusRect.width, item.plusRect.height, 8, this.theme.leftPanel);
                RenderUtil.drawText(this.ctx, '-', item.minusRect.x + item.minusRect.width / 2, item.minusRect.y + item.minusRect.height / 2, {
                    size: 18,
                    weight: '700',
                    color: this.theme.text,
                    align: 'center',
                });
                RenderUtil.drawText(this.ctx, '+', item.plusRect.x + item.plusRect.width / 2, item.plusRect.y + item.plusRect.height / 2, {
                    size: 18,
                    weight: '700',
                    color: this.theme.text,
                    align: 'center',
                });
                RenderUtil.drawText(this.ctx, FontUtil.trimTextToWidth(this.ctx, displayValue, item.inputRect.width - 12, { size: 13, weight: '700' }), item.inputRect.x + 6, item.inputRect.y + item.inputRect.height / 2, {
                    size: 13,
                    weight: '700',
                    color: this.theme.accent,
                });
            } else if (item.type === 'selector') {
                const expanded = this.openSelector === setting;
                RenderUtil.fillRoundedRect(this.ctx, item.fieldRect.x, item.fieldRect.y, item.fieldRect.width, item.fieldRect.height, 8, this.theme.leftPanel);
                RenderUtil.strokeRoundedRect(this.ctx, item.fieldRect.x, item.fieldRect.y, item.fieldRect.width, item.fieldRect.height, 8, expanded ? this.theme.accent : this.theme.fieldBorder, 1);
                RenderUtil.drawText(this.ctx, FontUtil.trimTextToWidth(this.ctx, setting.getValue(), item.fieldRect.width - 28, {
                    size: 13,
                    weight: '700',
                }), item.fieldRect.x + 8, item.fieldRect.y + item.fieldRect.height / 2, {
                    size: 13,
                    weight: '700',
                    color: this.theme.accent,
                });
                RenderUtil.drawText(this.ctx, expanded ? '▲' : '▼', item.fieldRect.x + item.fieldRect.width - 10, item.fieldRect.y + item.fieldRect.height / 2, {
                    size: 11,
                    weight: '700',
                    color: this.theme.text,
                    align: 'right',
                });

                if (item.optionRects) {
                    for (let optionIndex = 0; optionIndex < item.optionRects.length; optionIndex += 1) {
                        const optionRect = item.optionRects[optionIndex];
                        const selected = optionRect.option === setting.getValue();
                        RenderUtil.fillRoundedRect(this.ctx, optionRect.x, optionRect.y, optionRect.width, optionRect.height, 8, selected ? this.theme.leftTabActive : this.theme.leftPanel);
                        RenderUtil.strokeRoundedRect(this.ctx, optionRect.x, optionRect.y, optionRect.width, optionRect.height, 8, this.theme.fieldBorder, 1);
                        RenderUtil.drawText(this.ctx, FontUtil.trimTextToWidth(this.ctx, optionRect.option, optionRect.width - 16, {
                            size: 12,
                            weight: selected ? '700' : '600',
                        }), optionRect.x + 8, optionRect.y + optionRect.height / 2, {
                            size: 12,
                            weight: selected ? '700' : '600',
                            color: selected ? this.theme.text : this.theme.mutedText,
                        });
                    }
                }
            } else if (item.type === 'slider') {
                const [from, to] = setting.getValue();
                const span = setting.max - setting.min;
                const startX = item.trackRect.x + ((from - setting.min) / span) * item.trackRect.width;
                const endX = item.trackRect.x + ((to - setting.min) / span) * item.trackRect.width;
                const minActive = this.textInput && this.textInput.setting === setting && this.textInput.kind === 'slider-min';
                const maxActive = this.textInput && this.textInput.setting === setting && this.textInput.kind === 'slider-max';
                const minDisplayValue = minActive ? this.textInput.value : String(from);
                const maxDisplayValue = maxActive ? this.textInput.value : String(to);
                RenderUtil.fillRoundedRect(this.ctx, item.trackRect.x, item.trackRect.y, item.trackRect.width, item.trackRect.height, 4, this.theme.sliderTrack);
                RenderUtil.fillRoundedRect(this.ctx, startX, item.trackRect.y, Math.max(4, endX - startX), item.trackRect.height, 4, this.theme.sliderFill);
                RenderUtil.drawCircle(this.ctx, startX, item.trackRect.y + item.trackRect.height / 2, 7, {
                    color: this.theme.text,
                    strokeStyle: this.theme.panel,
                    lineWidth: 2,
                });
                RenderUtil.drawCircle(this.ctx, endX, item.trackRect.y + item.trackRect.height / 2, 7, {
                    color: this.theme.text,
                    strokeStyle: this.theme.panel,
                    lineWidth: 2,
                });
                RenderUtil.fillRoundedRect(this.ctx, item.minInputRect.x, item.minInputRect.y, item.minInputRect.width, item.minInputRect.height, 8, this.theme.leftPanel);
                RenderUtil.strokeRoundedRect(this.ctx, item.minInputRect.x, item.minInputRect.y, item.minInputRect.width, item.minInputRect.height, 8, minActive ? this.theme.accent : this.theme.fieldBorder, 1);
                RenderUtil.fillRoundedRect(this.ctx, item.maxInputRect.x, item.maxInputRect.y, item.maxInputRect.width, item.maxInputRect.height, 8, this.theme.leftPanel);
                RenderUtil.strokeRoundedRect(this.ctx, item.maxInputRect.x, item.maxInputRect.y, item.maxInputRect.width, item.maxInputRect.height, 8, maxActive ? this.theme.accent : this.theme.fieldBorder, 1);
                RenderUtil.drawText(this.ctx, FontUtil.trimTextToWidth(this.ctx, minDisplayValue, item.minInputRect.width - 8, {
                    size: 11,
                    weight: '700',
                }), item.minInputRect.x + item.minInputRect.width / 2, item.minInputRect.y + item.minInputRect.height / 2, {
                    size: 11,
                    weight: '700',
                    color: this.theme.accent,
                    align: 'center',
                });
                RenderUtil.drawText(this.ctx, '-', item.rangeSeparatorX, item.minInputRect.y + item.minInputRect.height / 2, {
                    size: 11,
                    weight: '700',
                    color: this.theme.mutedText,
                    align: 'center',
                });
                RenderUtil.drawText(this.ctx, FontUtil.trimTextToWidth(this.ctx, maxDisplayValue, item.maxInputRect.width - 8, {
                    size: 11,
                    weight: '700',
                }), item.maxInputRect.x + item.maxInputRect.width / 2, item.maxInputRect.y + item.maxInputRect.height / 2, {
                    size: 11,
                    weight: '700',
                    color: this.theme.accent,
                    align: 'center',
                });
            }
        }
    }

    onRender() {
        this.ensureSelectedModule();
        const layout = this.getLayout();
        this.drawPanel(layout);
        this.drawCategories(layout);
        this.drawModules(layout);
        this.drawSettings(layout);
    }
}
