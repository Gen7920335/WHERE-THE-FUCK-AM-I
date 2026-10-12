using System;
using System.Reflection.Emit;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace eft_where_am_i.Classes
{
    public class JavaScriptExecutor
    {
        private readonly WebView2 webView;
        private readonly SemaphoreSlim whereAmIInputLock = new SemaphoreSlim(1, 1);

        public JavaScriptExecutor(WebView2 webView)
        {
            this.webView = webView ?? throw new ArgumentNullException(nameof(webView));
        }

        /// <summary>
        /// C# 문자열을 안전한 JavaScript 문자열 리터럴로 변환합니다.
        /// 따옴표, 백슬래시, 줄바꿈 등 모든 특수문자를 올바르게 이스케이프하여
        /// JS 코드 인젝션을 방지합니다. null 입력도 안전하게 처리합니다.
        /// </summary>
        private static string JsLiteral(string value)
        {
            return JsonConvert.SerializeObject(value ?? string.Empty);
        }

        /// <summary>
        /// WebView2 초기화 완료 대기
        /// </summary>
        private async Task EnsureWebViewInitializedAsync()
        {
            if (webView.CoreWebView2 == null)
            {
                await webView.EnsureCoreWebView2Async(null);
            }
        }

        /// <summary>
        /// JavaScript 코드를 실행합니다.
        /// </summary>
        /// <param name="script">실행할 JavaScript 코드</param>
        public async Task ExecuteScriptAsync(string script)
        {
            try
            {
                await EnsureWebViewInitializedAsync(); // 초기화 대기

                if (webView.CoreWebView2 != null)
                {
                    await webView.CoreWebView2.ExecuteScriptAsync(script);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"JavaScript 실행 중 오류가 발생했습니다: {ex.Message}", "오류", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        /// <summary>
        /// 특정 버튼을 클릭하는 JavaScript 코드 실행
        /// </summary>
        /// <param name="selector">버튼의 CSS 셀렉터</param>
        public async Task ClickButtonAsync(string selector)
        {
            string Selector = JsLiteral(selector);
            string script = $@"
                var button = document.querySelector({Selector});
                if (button) {{
                    button.click();
                    console.log('Button clicked');
                }} else {{
                    console.log('Button not found');
                }}";
            await ExecuteScriptAsync(script);
        }

        private async Task<bool> IsWhereAmIInputAvailableAsync()
        {
            string selector = JsLiteral(Constants.WHERE_AM_I_INPUT_SELECTOR);
            string script = $@"
                (function() {{
                    var input = document.querySelector({selector});
                    return !!input && !input.disabled && !input.readOnly;
                }})()";
            try
            {
                await EnsureWebViewInitializedAsync();
                if (webView.CoreWebView2 == null) return false;

                string result = await webView.ExecuteScriptAsync(script);
                return result.Trim().ToLowerInvariant() == "true";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"JS 실행 실패: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Where Am I 위치 입력창이 열려 있는지 확인하고 필요한 경우 정확한 버튼만 누릅니다.
        /// Tarkov-Market의 툴바 순서가 바뀌어도 회전 버튼을 잘못 누르지 않습니다.
        /// </summary>
        public async Task<bool> EnsureWhereAmIInputAsync(int attempts = 10, int delayMs = 100)
        {
            string inputSelector = JsLiteral(Constants.WHERE_AM_I_INPUT_SELECTOR);
            string scriptTemplate = $@"
                (function() {{
                    var input = document.querySelector({inputSelector});
                    if (input && !input.disabled && !input.readOnly) {{
                        return 'ready';
                    }}

                    var terminalButton = document.querySelector('#terminalWhereButton');
                    if (terminalButton) {{
                        terminalButton.click();
                        return 'clicked';
                    }}

                    var panel = document.querySelector('.panel_top');
                    if (!panel) return 'panel-not-found';

                    var isVisible = function(element) {{
                        return !!element && element.offsetParent !== null && !element.disabled;
                    }};
                    var normalizedLabels = ['where am i?', '내 위치는?'];
                    var hasWhereAmILabel = function(candidate) {{
                        return normalizedLabels.includes((candidate.textContent || '').trim().toLowerCase());
                    }};
                    var buttons = Array.from(panel.querySelectorAll('button'));
                    var button = buttons.find(function(candidate) {{
                        return hasWhereAmILabel(candidate) && isVisible(candidate);
                    }});

                    // 2026-10 UI: the location button lives in the toolbar's More (⋯) dropdown.
                    var more = panel.querySelector('.dropdown.toolbar-more');
                    if (!button && more) {{
                        var menuButtons = Array.from(more.querySelectorAll('.dd-content button'));
                        var coordinateButton = menuButtons.find(hasWhereAmILabel) ||
                            more.querySelector('.dd-content > div > button:nth-child(2)');
                        if (coordinateButton && !coordinateButton.disabled) {{
                            coordinateButton.click();
                            return 'clicked';
                        }}
                        if (__MENU_OPENED__) return 'waiting-for-menu';

                        var menuButton = more.querySelector(':scope > div > button, :scope > button');
                        if (!menuButton) return 'menu-button-not-found';
                        menuButton.click();
                        return 'menu-opened';
                    }}

                    if (!button) {{
                        button = panel.querySelector(
                            '.toolbar-group.primary-tools > button:first-child, ' +
                            '.d-flex.ml-15 > button'
                        );
                    }}

                    if (!button) {{
                        var rotateButton = buttons.find(function(candidate) {{
                            var label = ((candidate.getAttribute('aria-label') || '') + ' ' +
                                (candidate.getAttribute('title') || '')).toLowerCase();
                            var text = (candidate.textContent || '').trim();
                            return label.includes('rotate') || label.includes('회전') || text.includes('°');
                        }});
                        var nextGroup = rotateButton && rotateButton.parentElement
                            ? rotateButton.parentElement.nextElementSibling
                            : null;
                        if (nextGroup && nextGroup.matches('.d-flex.ml-15')) {{
                            button = nextGroup.querySelector(':scope > button');
                        }}
                    }}

                    if (!button) return 'button-not-found';
                    button.click();
                    return 'clicked';
                }})()";

            await whereAmIInputLock.WaitAsync();
            try
            {
                await EnsureWebViewInitializedAsync();
                if (webView.CoreWebView2 == null) return false;

                bool menuOpened = false;
                bool clickIssued = false;
                for (int attempt = 0; attempt < attempts; attempt++)
                {
                    if (await IsWhereAmIInputAvailableAsync()) return true;

                    if (!clickIssued)
                    {
                        string script = scriptTemplate.Replace("__MENU_OPENED__", menuOpened ? "true" : "false");
                        string result = await webView.CoreWebView2.ExecuteScriptAsync(script);
                        string status = JsonConvert.DeserializeObject<string>(result) ?? string.Empty;
                        if (status == "ready") return true;
                        if (status == "menu-opened") menuOpened = true;
                        clickIssued = status == "clicked";
                    }

                    if (delayMs > 0)
                    {
                        await Task.Delay(delayMs);
                    }
                }

                return await IsWhereAmIInputAvailableAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WhereAmI] Failed to open location input: {ex.Message}");
                return false;
            }
            finally
            {
                whereAmIInputLock.Release();
            }
        }

        /// <summary>
        /// Where Am I 전용 입력창에만 좌표 파일명을 설정합니다.
        /// 검색창이나 다른 텍스트 입력에는 값을 쓰지 않습니다.
        /// </summary>
        public async Task<bool> SetWhereAmIInputValueAsync(string value)
        {
            string selector = JsLiteral(Constants.WHERE_AM_I_INPUT_SELECTOR);
            string escapedValue = JsLiteral(value);
            string script = $@"
                (function() {{
                    var input = document.querySelector({selector});
                    if (!input || input.disabled || input.readOnly) {{
                        return false;
                    }}

                    var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeSetter.call(input, {escapedValue});
                    try {{
                        input.dispatchEvent(new InputEvent('input', {{ bubbles: true, cancelable: true, inputType: 'insertText', data: {escapedValue} }}));
                    }} catch(e) {{
                        var ev = document.createEvent('Event');
                        ev.initEvent('input', true, true);
                        input.dispatchEvent(ev);
                    }}
                    input.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    try {{ input.focus(); input.blur(); }} catch(e) {{}}
                    return true;
                }})();";

            try
            {
                await EnsureWebViewInitializedAsync();
                if (webView.CoreWebView2 == null) return false;

                string result = await webView.CoreWebView2.ExecuteScriptAsync(script);
                return result.Trim().ToLowerInvariant() == "true";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WhereAmI] Failed to set location input: {ex.Message}");
                return false;
            }
        }

        public async Task SetQuestPinsAsync(IReadOnlyCollection<string> questNames)
        {
            string questNamesJson = JsonConvert.SerializeObject(questNames ?? Array.Empty<string>());
            await ExecuteScriptAsync($"window.__wtfQuestOverlay?.setPinnedQuests({questNamesJson});");
        }

        /// <summary>
        /// 층 버튼을 클릭하여 맵 층을 전환합니다.
        /// </summary>
        public async Task ClickFloorAsync(string floorName)
        {
            string escapedName = JsLiteral(floorName);
            string script = $@"
            (function() {{
                const inputs = document.querySelectorAll('.no-wrap input[name=""layers""]');
                for (const input of inputs) {{
                    if (input.parentNode.innerText.includes({escapedName})) {{
                        input.click();
                        break;
                    }}
                }}
            }})()";

            await ExecuteScriptAsync(script);
        }

        /// <summary>
        /// 여러 층 이름 후보를 한 번의 JS 호출로 시도합니다. 순서대로 매칭하여 첫 번째 매칭을 클릭.
        /// </summary>
        public async Task<bool> ClickFloorByFirstMatchAsync(string[] floorNames)
        {
            try
            {
                await EnsureWebViewInitializedAsync();
                if (webView.CoreWebView2 == null) return false;

                string jsArray = "[" + string.Join(",", (floorNames ?? Array.Empty<string>()).Select(n => JsLiteral(n))) + "]";

                string script = $@"
                (function() {{
                    const names = {jsArray};
                    const inputs = document.querySelectorAll('.no-wrap input[name=""layers""]');
                    for (const name of names) {{
                        for (const input of inputs) {{
                            if (input.parentNode.innerText.includes(name)) {{
                                input.click();
                                return 'true';
                            }}
                        }}
                    }}
                    return 'false';
                }})()";

                string result = await webView.CoreWebView2.ExecuteScriptAsync(script);
                return result?.Trim('"') == "true";
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// 맵 위에 폴리곤 오버레이 + 에디터 UI를 주입합니다.
        /// </summary>
        public async Task EnableFloorEditModeAsync(string existingZonesJson, string floorsJson)
        {
            // Inject overlay
            await ExecuteScriptAsync(Constants.POLYGON_OVERLAY_SCRIPT);

            // Set existing zones data
            string escapedZonesJson = JsLiteral(existingZonesJson ?? "[]");
            await ExecuteScriptAsync($"window.__floorEditorZones = JSON.parse({escapedZonesJson});");

            // Set floors data for select dropdown
            string escapedFloorsJson = JsLiteral(floorsJson ?? "[]");
            await ExecuteScriptAsync($"window.__floorEditorFloors = JSON.parse({escapedFloorsJson});");

            // Render existing zones
            await ExecuteScriptAsync("if(window.__renderFloorZones) window.__renderFloorZones(window.__floorEditorZones);");

            // Inject editor UI
            await ExecuteScriptAsync(Constants.FLOOR_EDITOR_UI_SCRIPT);
        }

        /// <summary>
        /// 폴리곤 오버레이 + 에디터 UI를 제거합니다.
        /// </summary>
        public async Task DisableFloorEditModeAsync()
        {
            await ExecuteScriptAsync(@"
            (function() {
                var overlay = document.getElementById('floor-polygon-overlay');
                if (overlay) overlay.remove();
                var panel = document.getElementById('floor-editor-panel');
                if (panel) panel.remove();
                window.__floorEditClickEnabled = false;
                window.__floorEditorZones = [];
                window.__floorCurrentVertices = [];
            })();");
        }

        /// <summary>
        /// CDP (Chrome DevTools Protocol)를 사용하여 trusted 마우스 드래그를 실행합니다.
        /// isTrusted: true 이벤트를 생성하여 tarkov-market의 맵 핸들러가 인식합니다.
        /// </summary>
        /// <param name="animate">true면 각 단계 사이에 딜레이를 주어 부드러운 애니메이션 효과</param>
        private async Task<bool> CdpMouseDragAsync(double startX, double startY, double endX, double endY, int steps = 10, bool animate = true)
        {
            try
            {
                var cdp = webView.CoreWebView2;

                // mousePressed at start position
                await cdp.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",
                    string.Format(CultureInfo.InvariantCulture,
                        "{{\"type\":\"mousePressed\",\"x\":{0},\"y\":{1},\"button\":\"left\",\"clickCount\":1}}",
                        startX, startY));

                // mouseMoved in steps (with optional delay for animation)
                int delayMs = animate ? 20 : 0;
                for (int s = 1; s <= steps; s++)
                {
                    double t = (double)s / steps;
                    double cx = startX + (endX - startX) * t;
                    double cy = startY + (endY - startY) * t;
                    await cdp.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",
                        string.Format(CultureInfo.InvariantCulture,
                            "{{\"type\":\"mouseMoved\",\"x\":{0},\"y\":{1},\"button\":\"left\",\"buttons\":1}}",
                            cx, cy));

                    if (delayMs > 0 && s < steps)
                        await Task.Delay(delayMs);
                }

                // mouseReleased at end position
                await cdp.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",
                    string.Format(CultureInfo.InvariantCulture,
                        "{{\"type\":\"mouseReleased\",\"x\":{0},\"y\":{1},\"button\":\"left\",\"clickCount\":1}}",
                        endX, endY));

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AutoPan] CDP drag failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// 마커가 데드존 밖에 있으면 자동으로 맵을 팬합니다.
        /// 1차: __deadZoneCalc()로 좌표 계산 → CDP trusted mouse drag
        /// 2차: CDP 실패 시 __deadZoneAutoPanCSS() CSS fallback (애니메이션 지원)
        /// </summary>
        /// <param name="deadZonePercent">내부 경계 비율 (93 = 가장자리 3.5% 여백)</param>
        /// <param name="animate">CSS fallback 시 애니메이션 적용 여부</param>
        /// <returns>팬 실행 여부</returns>
        public async Task<bool> AutoPanToMarkerAsync(int deadZonePercent = 93, bool animate = true)
        {
            try
            {
                await EnsureWebViewInitializedAsync();
                if (webView.CoreWebView2 == null) return false;

                // Step 1: __deadZoneCalc()로 팬 필요 여부 및 좌표 계산
                string calcScript = $"(function(){{ return window.__deadZoneCalc ? window.__deadZoneCalc({deadZonePercent}) : JSON.stringify({{ needsPan: false, reason: 'not-injected' }}); }})()";
                string calcRaw = await webView.CoreWebView2.ExecuteScriptAsync(calcScript);

                if (string.IsNullOrEmpty(calcRaw) || calcRaw == "null")
                    return false;

                string calcJson = JsonConvert.DeserializeObject<string>(calcRaw);
                var calcObj = JObject.Parse(calcJson);
                bool needsPan = calcObj["needsPan"]?.Value<bool>() ?? false;
                string reason = calcObj["reason"]?.ToString() ?? "";

                if (!needsPan)
                {
                    // inside-boundary 또는 no-marker/no-map
                    return false;
                }

                double dx = calcObj["dx"]?.Value<double>() ?? 0;
                double dy = calcObj["dy"]?.Value<double>() ?? 0;
                double startX = calcObj["startX"]?.Value<double>() ?? 0;
                double startY = calcObj["startY"]?.Value<double>() ?? 0;
                double endX = calcObj["endX"]?.Value<double>() ?? 0;
                double endY = calcObj["endY"]?.Value<double>() ?? 0;

                // Step 2: CDP trusted mouse drag 시도 (애니메이션 옵션 포함)
                bool cdpSuccess = await CdpMouseDragAsync(startX, startY, endX, endY, steps: 10, animate: animate);
                if (cdpSuccess)
                {
                    Console.WriteLine($"[AutoPan] Panned via CDP: dx={dx}, dy={dy}");
                    return true;
                }

                // Step 3: CDP 실패 시 CSS transform fallback (애니메이션 옵션 포함)
                string animateJs = animate ? "true" : "false";
                string fallbackScript = $"(function(){{ return window.__deadZoneAutoPanCSS ? window.__deadZoneAutoPanCSS({deadZonePercent}, {animateJs}) : JSON.stringify({{ panned: false, reason: 'not-injected' }}); }})()";
                string fallbackRaw = await webView.CoreWebView2.ExecuteScriptAsync(fallbackScript);

                if (!string.IsNullOrEmpty(fallbackRaw) && fallbackRaw != "null")
                {
                    string fallbackJson = JsonConvert.DeserializeObject<string>(fallbackRaw);
                    var fallbackObj = JObject.Parse(fallbackJson);
                    bool fallbackPanned = fallbackObj["panned"]?.Value<bool>() ?? false;

                    if (fallbackPanned)
                    {
                        Console.WriteLine($"[AutoPan] Panned via CSS fallback: dx={fallbackObj["dx"]}, dy={fallbackObj["dy"]}, animated={animate}");
                        return true;
                    }
                }

                return false;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AutoPan] Error: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// 패널이 현재 숨겨져 있는지 확인합니다.
        /// 원본 패널의 collapsed 클래스를 우선 사용하고, 패널 DOM이 아직 준비되지
        /// 않은 경우에만 버튼 텍스트를 보조 판정으로 사용합니다.
        /// </summary>
        public async Task<bool> IsPanelHiddenAsync()
        {
            try
            {
                await EnsureWebViewInitializedAsync();
                if (webView.CoreWebView2 == null) return false;

                string script = $@"
                (function() {{
                    var btn = document.querySelector({JsLiteral(Constants.HIDE_SHOW_PANEL_BUTTON_SELECTOR)});
                    if (btn) {{
                        var label = ((btn.getAttribute('aria-label') || '') + ' ' +
                            (btn.getAttribute('title') || '') + ' ' +
                            (btn.textContent || '')).toLowerCase();
                        if (label.includes('show panel') || label.includes('show pannels') || label.includes('패널 표시')) return 'true';
                        if (label.includes('hide panel') || label.includes('hide pannels') || label.includes('패널 숨기기')) return 'false';
                        var pressed = btn.getAttribute('aria-pressed');
                        if (pressed !== null) return pressed.toLowerCase() === 'false' ? 'true' : 'false';
                    }}
                    var leftPanel = document.querySelector('.panel_left');
                    var rightPanel = document.querySelector('.panel_right');
                    if (leftPanel || rightPanel) {{
                        var isCollapsed = Boolean(
                            leftPanel && leftPanel.classList.contains('collapsed')
                            || rightPanel && rightPanel.classList.contains('collapsed')
                        );
                        return isCollapsed ? 'true' : 'false';
                    }}

                    return 'false';
                }})()";

                string result = await webView.CoreWebView2.ExecuteScriptAsync(script);
                return result?.Trim('"') == "true";
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// 패널이 닫혀 있으면 빠르게 열어줍니다.
        /// </summary>
        public async Task<bool> OpenPanelIfHiddenAsync(int attempts = 3, int delayMs = 100)
        {
            try
            {
                await EnsureWebViewInitializedAsync();
                if (webView.CoreWebView2 == null) return false;

                for (int i = 0; i < attempts; i++)
                {
                    if (!await IsPanelHiddenAsync())
                    {
                        return true;
                    }

                    string script = $@"
                    (function() {{
                        var btn = document.querySelector({JsLiteral(Constants.HIDE_SHOW_PANEL_BUTTON_SELECTOR)});
                        if (!btn) return 'not-found';
                        btn.click();
                        return 'clicked';
                    }})();";

                    await webView.CoreWebView2.ExecuteScriptAsync(script);
                    if (delayMs > 0)
                    {
                        await Task.Delay(delayMs);
                    }
                }

                return !await IsPanelHiddenAsync();
            }
            catch
            {
                return false;
            }
        }
    }
}
