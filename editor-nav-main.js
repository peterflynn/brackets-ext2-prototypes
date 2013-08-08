/*
 * Copyright (c) 2012 Peter Flynn.
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


/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $ */
// <<Restartless>> -- FOR FREE  -->  commands, menus, keybindings(complex action!), quickopen

define(function (require, exports, module) {
    "use strict";
    
    // Brackets modules
    var fileOpenCommand,
        DocumentManager,
        ProjectManager,
        QuickOpen;
    
    
    /**
     * @param {string} query User query/filter string
     * @return {Array.<SearchResult>} Sorted and filtered results that match the query
     */
    function search(query, matcher) {
        /* @type {Array.<FileEntry>} */
        var workingSet = DocumentManager.getWorkingSet();
        
        query = query.substr(1);  // lose the "/" prefix
        
        // Filter and rank how good each match is
        var filteredList = $.map(workingSet, function (fileEntry) {
            // Match query against the full project-relative path, like regular Quick Open
            var fullPath, projRelPath;
            if (fileEntry.isInaccessible) {
                // But exclude dummy path of Untitled docs (which regular Quick Open never encounters)
                fullPath = fileEntry.name;
                projRelPath = fullPath;
            } else {
                fullPath = fileEntry.fullPath;
                projRelPath = ProjectManager.makeProjectRelativeIfPossible(fullPath);  // unlike regular QO, this might fail & be left abs
            }
            
            var searchResult = matcher.match(projRelPath, query);
            if (searchResult) {
                searchResult.label = fileEntry.name;
                searchResult.fullPath = fileEntry.fullPath;
            }
            return searchResult;
        });
        
        // Sort based on ranking & basic alphabetical order
        QuickOpen.basicMatchSort(filteredList);

        return filteredList;
    }

    /**
     * @param {string} query
     * @return {boolean} true if this plugin wants to provide results for this query
     */
    function match(query) {
        if (query.indexOf("/") === 0) {
            return true;
        }
    }

    /**
     * @param {SearchResult} selectedItem
     */
    function itemSelect(selectedItem) {
        // Switch to that file
        if (selectedItem) {
            fileOpenCommand.execute({fullPath: selectedItem.fullPath});
        }
    }
    
    
    /**
     * @param {SearchResult} fileEntry
     * @param {string} query
     * @return {string}
     */
    function resultFormatter(item, query) {
        // TODO: identical to QuickOpen._filenameResultsFormatter()
        
        // For main label, we just want filename: drop most of the string
        function fileNameFilter(includesLastSegment, rangeText) {
            if (includesLastSegment) {
                var rightmostSlash = rangeText.lastIndexOf('/');
                return rangeText.substring(rightmostSlash + 1);  // safe even if rightmostSlash is -1
            } else {
                return "";
            }
        }
        var displayName = QuickOpen.highlightMatch(item, null, fileNameFilter);
        var displayPath = QuickOpen.highlightMatch(item, "quicksearch-pathmatch");
        
        return "<li>" + displayName + "<br /><span class='quick-open-path'>" + displayPath + "</span></li>";
    }
    
    
    
    /**
     * Returns the next/previous entry in working set UI list order
     * @param {number} inc
     * @return {FileEntry}
     */
    function getRelativeFile(inc) {
        var currentDocument = DocumentManager.getCurrentDocument();
        if (currentDocument) {
            var workingSetI = DocumentManager.findInWorkingSet(currentDocument.file.fullPath);
            if (workingSetI !== -1) {
                var workingSet = DocumentManager.getWorkingSet();
                var switchToI = workingSetI + inc;
                if (switchToI < 0) {
                    switchToI += workingSet.length;
                } else if (switchToI >= workingSet.length) {
                    switchToI -= workingSet.length;
                }
                return workingSet[switchToI];
            }
        }
        
        // If no doc open or working set empty, there is no "next" file
        return null;
    }
    
    function goNextFile() {
        var file = getRelativeFile(+1);
        if (file) {
            fileOpenCommand.execute({ fullPath: file.fullPath });
        }
    }
    function goPrevFile() {
        var file = getRelativeFile(-1);
        if (file) {
            fileOpenCommand.execute({ fullPath: file.fullPath });
        }
    }
    

    function load(services) {
        fileOpenCommand = services.commands.fileOpen;
        QuickOpen = services.quickOpen;
        DocumentManager = services.document;
        ProjectManager = services.project;
        
        // Commands for back/forward navigation shortcuts
        var GO_NEXT_COMMAND_ID = "pflynn.goWorkingSetNext";
        var GO_PREV_COMMAND_ID = "pflynn.goWorkingSetPrev";
        services.commands.add("Next Document in List", GO_NEXT_COMMAND_ID, goNextFile);
        services.commands.add("Previous Document in List", GO_PREV_COMMAND_ID, goPrevFile);
        
        // Add menus items in reverse order: we can't use Menus.BEFORE relative to a divider, so
        // use Menus.AFTER on the item just above the divider
        var menu = services.menus.navigateMenu;
        menu.addItem(GO_PREV_COMMAND_ID, null, services.menus.AFTER, services.commands.navigatePrevDoc);
        menu.addItem(GO_NEXT_COMMAND_ID, null, services.menus.AFTER, services.commands.navigateNextDoc);
        menu.addDivider(services.menus.AFTER, services.commands.navigatePrevDoc);
        
        // Take over the default (but redundant: Tab/Shift+Tab do the same thing) indent/unindent
        // commands so we can use them.
        services.keyboard.replaceBinding("Ctrl-[", GO_PREV_COMMAND_ID);
        services.keyboard.replaceBinding("Ctrl-]", GO_NEXT_COMMAND_ID);
        
        
        // Register as a new Quick Open mode
        services.quickOpen.addQuickOpenPlugin(
            {
                name: "Commands",
                languageIds: [],  // empty array = all file types
                done: function () {},
                search: search,
                match: match,
                itemFocus: function () {},
                itemSelect: itemSelect,
                resultsFormatter: resultFormatter,
                matcherOptions: { segmentedSearch: true }
            }
        );
        
        // Command to launch our Quick Open mode
        var SEARCH_WORKING_SET_COMMAND_ID = "pflynn.searchWorkingSetFiles";
        services.commands.add("Go to Open File", SEARCH_WORKING_SET_COMMAND_ID, function () {
            // Begin Quick Open in our search mode
            services.quickOpen.beginSearch("/");
        });
        menu.addItem(SEARCH_WORKING_SET_COMMAND_ID, "Ctrl-Shift-E", services.menu.AFTER, GO_PREV_COMMAND_ID);
    }
    exports.load = load;
    
});
