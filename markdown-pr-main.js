/*
 * Copyright (c) 2012 Glenn Ruehle
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true,  regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, window, PathUtils, marked */
// <<Restartless>> -- NOT free  -->  DM listeners, UI injection, UI listeners (non-DOM), stylesheet loading (ignoring listeners on orphaned DOM)  ///  per-Document listeners

define(function (require, exports, module) {
    "use strict";

    // Brackets modules
    var DocumentManager,
        ui;

    // Local modules
    var panelHTML   = require("text!panel.html");
    var marked      = require("marked");
    
    // jQuery objects
    var $icon,
        $iframe;
    
    // Other vars
    var currentDoc,
        panel,
        visible = false,
        realVisibility = false;
    
    function _loadDoc(doc, preserveScrollPos) {
        if (doc && visible && $iframe) {
            var docText     = doc.getText(),
                scrollPos   = 0,
                bodyText    = "",
                yamlRegEx   = /^-{3}([\w\W]+?)(-{3})/,
                yamlMatch   = yamlRegEx.exec(docText);

            // If there's yaml front matter, remove it.
            if (yamlMatch) {
                docText = docText.substr(yamlMatch[0].length);
            }
            
            if (preserveScrollPos) {
                scrollPos = $iframe.contents()[0].body.scrollTop;
            }
            
            // Parse markdown into HTML
            bodyText = marked(docText);
            
            // Remove link hrefs
            bodyText = bodyText.replace(/href=\"([^\"]*)\"/g, "title=\"$1\"");
            var htmlSource = "<html><head>";
            htmlSource += "<link href='" + require.toUrl("./markdown.css") + "' rel='stylesheet'></link>";
            htmlSource += "</head><body onload='document.body.scrollTop=" + scrollPos + "'>";
            htmlSource += bodyText;
            htmlSource += "</body></html>";
            $iframe.attr("srcdoc", htmlSource);
        }
    }
    
    function _documentChange(e) {
        _loadDoc(e.target, true);
    }
    
    function _resizeIframe() {
        if (visible && $iframe) {
            var iframeWidth = panel.$panel.innerWidth();
            $iframe.attr("width", iframeWidth + "px");
        }
    }
    
    function _setPanelVisibility(isVisible) {
        if (isVisible === realVisibility) {
            return;
        }
        
        realVisibility = isVisible;
        if (isVisible) {
            if (!panel) {
                var $panel = $(panelHTML);
                $iframe = $panel.find("#panel-markdown-preview-frame");
                
                panel = ui.createBottomPanel("markdown-preview-panel", $panel);  // auto cleaned up, even though not done in load()
                $panel.on("panelResizeUpdate", function (e, newSize) {
                    $iframe.attr("height", newSize);
                });
                $iframe.attr("height", $panel.height());

                window.setTimeout(_resizeIframe);
            }
            _loadDoc(DocumentManager.getCurrentDocument());
            $icon.toggleClass("active");
            panel.show();
        } else {
            $icon.toggleClass("active");
            panel.hide();
        }
    }

    function _currentDocChangedHandler() {
        var doc = DocumentManager.getCurrentDocument(),
            ext = doc ? PathUtils.filenameExtension(doc.file.fullPath).toLowerCase() : "";
        
        if (currentDoc) {
            $(currentDoc).off("change", _documentChange);
            currentDoc = null;
        }
        
        if (doc && /md|markdown|txt/.test(ext)) {
            currentDoc = doc;
            $(currentDoc).on("change", _documentChange);
            $icon.css({display: "block"});
            _setPanelVisibility(visible);
            _loadDoc(doc);
        } else {
            $icon.css({display: "none"});
            _setPanelVisibility(false);
        }
    }
    
    function _toggleVisibility() {
        visible = !visible;
        _setPanelVisibility(visible);
    }
    
    function load(services) {
        DocumentManager = services.documents;
        
        // Insert CSS for this extension
        services.ui.loadStyleSheet(module, "MarkdownPreview.css");
        
        // Add toolbar icon 
        $icon = $("<a>")
            .attr({
                id: "markdown-preview-icon",
                href: "#"
            })
            .css({
                display: "none"
            })
            .click(_toggleVisibility);
        
        services.ui.inject($icon, $("#main-toolbar .buttons"));  // or services.ui.toolbarButtons.inject($icon), or services.ui.inject($icon, services,ui,toolbarButtons)
        
        // Add a document change handler
        services.documents.on("currentDocumentChange", _currentDocChangedHandler);
        _currentDocChangedHandler();
        
        // Listen for resize events
        services.ui.panels.editorArea.on("resize", _resizeIframe);
    }
    function unload() {
        if (currentDoc) {
            $(currentDoc).off("change", _documentChange);
            currentDoc = null;
        }
    }
    exports.load = load;
    exports.unload = unload;
});
