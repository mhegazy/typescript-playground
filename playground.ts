/// <reference types="monaco-editor" />

declare const require: any;
declare const startTime: number;
declare namespace monaco.editor {
    interface IModel {
        getLineTokens(count: number): void;
    }
}

(function () {
    "use strict";

    const examples = <HTMLSelectElement>document.getElementById('examples');
    const wrapper = <HTMLDivElement>document.getElementById('wrapper');
    const excuteButton = <HTMLInputElement>document.getElementById("execute");
    const shareButton = <HTMLInputElement>document.getElementById("share");
    const shareMessageLabel = <HTMLSpanElement>document.getElementById("share-message");

    const lhs = {
        domNode: document.getElementById('typescriptEditor'),
        editor: <monaco.editor.IStandaloneCodeEditor>null
    };

    const rhs = {
        domNode: document.getElementById('javascriptEditor'),
        editor: <monaco.editor.IStandaloneCodeEditor>null
    };

    let editorLoaded = false;
    let sampleLoaded = false;

    // ------------ Loading logic
    (function () {
        const DEFAULT_EXAMPLE = '/examples/walkthrough2.ts';
        let sample = '';

        require.config({ paths: { 'vs': './node_modules/monaco-editor/min/vs' } });
        require(['vs/editor/editor.main', 'vs/language/typescript/lib/typescriptServices'], function () {
            lhs.editor = monaco.editor.create(lhs.domNode, {
                value: sample,
                language: "typescript",
                formatOnType: true,
                renderWhitespace: true
            });

            rhs.editor = monaco.editor.create(rhs.domNode, {
                value: "",
                language: "javascript",
                readOnly: true,
                renderWhitespace: true
            });

            console.info('editors rendered @@ ' + ((new Date()).getTime() - startTime) + 'ms');
            editorLoaded = true;
            onSomethingLoaded();
        });

        (function () {
            const queryStringSrcStart = window.location.hash.indexOf("#src=");
            const tutorialStart = window.location.hash.indexOf('#tut=');
            const localStorageStart = window.localStorage && window.localStorage["src"];


            function loadTutorial() {
                const tutorialName = window.location.hash.substring('#tut='.length);
                const path = '/examples/' + tutorialName + '.ts';
                xhr(path, xhr => {
                    sample = xhr.responseText;
                    sampleLoaded = true;
                    onSomethingLoaded();
                }, _ => {
                    loadInitialText(false, true, true);
                });
            }
            function loadByQueryString() {
                const encoded = window.location.hash.substring("#src=".length);
                try {
                    sample = decodeURIComponent(encoded);
                    sampleLoaded = true;
                    onSomethingLoaded();
                    return;
                } catch (e) {
                    console.log("unable to parse #src= uri component");
                    // intentionally fall through to alternatives if decode fails
                }
            }

            function loadByLocalStorage() {
                sampleLoaded = true;
                sample = localStorageStart;
                onSomethingLoaded();
            }

            function loadDefault() {
                examples.selectedIndex = 3;
                xhr(DEFAULT_EXAMPLE, xmlHttpReq => {
                    sampleLoaded = true;
                    sample = xmlHttpReq.responseText;
                    onSomethingLoaded();
                });
            }

            function loadInitialText(tryTutorial: boolean, tryQueryString:boolean, tryLocalStorage: boolean) {
                if (tryTutorial && tutorialStart === 0)
                    loadTutorial();
                else if (tryQueryString && queryStringSrcStart === 0)
                    loadByQueryString();
                else if (tryLocalStorage && localStorageStart)
                    loadByLocalStorage();
                else
                    loadDefault();
            }

            loadInitialText(true, true, true);
        })();

        function onSomethingLoaded() {
            if (editorLoaded && sampleLoaded) {
                lhs.editor.getModel().setValue(sample);
                console.info('sample rendered @@ ' + ((new Date()).getTime() - startTime) + 'ms');
                console.info('starting compilation @@ ' + ((new Date()).getTime() - startTime) + 'ms');
                triggerCompile();
                lhs.editor.onDidChangeModelContent(function () {
                    triggerCompile();
                    // hide the message if one is there
                    shareMessageLabel.style.display = "none";
                });
                console.info('sample compiled @@ ' + ((new Date()).getTime() - startTime) + 'ms');
            }
        }
    })();

    // ------------ Resize logic
    function resize() {
        // incorporate header and footer and adaptive layout
        const headerSize = 0; // 120
        const footerSize = 51;

        const horizontalSpace = 10;
        const wrapperSizeDiff = headerSize + footerSize;
        const windowHeight = window.innerHeight || document.body.offsetHeight || document.documentElement.offsetHeight;

        wrapper.style.height = (windowHeight - wrapper.offsetTop - wrapperSizeDiff) + "px";
        const halfWidth = Math.floor((wrapper.clientWidth - 40) / 2) - 8 - (horizontalSpace / 2);

        // Layout lhs
        const lhsSizeDiff = wrapperSizeDiff + 40;
        lhs.domNode.style.width = halfWidth + "px";
        lhs.domNode.style.height = (windowHeight - wrapper.offsetTop - lhsSizeDiff) + "px";
        if (lhs.editor) {
            lhs.editor.layout();
        }

        // Layout rhs
        const rhsSizeDiff = wrapperSizeDiff + 40;
        rhs.domNode.style.left = (halfWidth + 2 + horizontalSpace) + "px";
        rhs.domNode.style.width = halfWidth + "px";
        rhs.domNode.style.height = (windowHeight - wrapper.offsetTop - rhsSizeDiff) + "px";
        rhs.domNode.style.top = -(wrapper.clientHeight - 38) + "px";
        if (rhs.editor) {
            rhs.editor.layout();
        }
    }
    resize();
    window.onresize = resize;

    // ------------ Compilation logic
    let compilerTriggerTimeoutID: number | null = null;
    function triggerCompile() {
        if (compilerTriggerTimeoutID !== null) {
            window.clearTimeout(compilerTriggerTimeoutID);
        }

        compilerTriggerTimeoutID = window.setTimeout(function () {
            try {
                if (!sampleLoaded || !editorLoaded) {
                    console.log("not loaded");
                }
                const output = transpileModule(lhs.editor.getValue(), {
                    module: ts.ModuleKind.AMD,
                    target: ts.ScriptTarget.ES5,
                    noLib: true,
                    noResolve: true,
                    suppressOutputPathCheck: true
                });

                if (typeof output === "string") {
                    const rhsModel = rhs.editor.getModel();
                    // Save view state
                    const viewState = rhs.editor.saveViewState();
                    // Update content
                    rhsModel.setValue(output);
                    // Remove flicker: force tokenization
                    rhsModel.getLineTokens(rhsModel.getLineCount());
                    // Restore view state
                    rhs.editor.restoreViewState(viewState);
                    // Remove flicker: force rendering
                    rhs.editor.getOffsetForColumn(1, 1);
                }
            } catch (e) {
                console.log("Error from compilation: " + e + "  " + (e.stack || ""));
            }
        }, 100);
    }

    function transpileModule(input: string, options: ts.CompilerOptions) {
        const inputFileName = options.jsx ? "module.tsx" : "module.ts";
        const sourceFile = ts.createSourceFile(inputFileName, input, options.target || ts.ScriptTarget.ES5);
        // Output
        let outputText: string;
        const program = ts.createProgram([inputFileName], options, {
            getSourceFile(fileName) { return fileName.indexOf("module") === 0 ? sourceFile : undefined; },
            writeFile(_name, text) { outputText = text; },
            getDefaultLibFileName() { return "lib.d.ts"; },
            useCaseSensitiveFileNames() { return false; },
            getCanonicalFileName(fileName) { return fileName; },
            getCurrentDirectory() { return ""; },
            getNewLine() { return "\r\n"; },
            fileExists(fileName) { return fileName === inputFileName; },
            readFile() { return ""; },
            directoryExists() { return true; },
            getDirectories() { return []; }
        });
        // Emit
        program.emit();
        if (outputText === undefined) {
            throw new Error("Output generation failed");
        }
        return outputText;
    }

    // ------------ Execution logic
    excuteButton.onclick = function () {
        const external = window.open();
        const script = external.window.document.createElement("script");
        script.textContent = rhs.editor.getModel().getValue();
        external.window.document.body.appendChild(script);
        //external.window.eval(rhs.editor.getModel().getValue());
    };

    examples.onchange = function () {
        const selectedExample = examples.options[examples.selectedIndex].value;
        if (selectedExample != "") {
            xhr('/examples/' + selectedExample, xmlHttpReq => {
                if (editorLoaded) {
                    lhs.editor.getModel().setValue(xmlHttpReq.responseText);
                }
            });
        }
    }

    let ignoreHashChange = false;

    // ------------ Sharing logic
    shareButton.onclick = function () {
        if (!editorLoaded || !sampleLoaded)
            return;
        const text = lhs.editor.getModel().getValue();
        const encoded = encodeURIComponent(text);
        ignoreHashChange = true;
        window.location.replace(window.location + "#src=" + encoded);

        shareMessageLabel.style.display = "inline";
        let decodedHashLength = -1;
        try {
            // this can throw when the hash gets cut off due to URI length in the middle of a %OA style escape
            decodedHashLength = decodeURIComponent(window.location.hash).length;
        } catch (e) {
        }
        if (decodedHashLength === text.length + 5) {
            shareMessageLabel.textContent = " Shareable link now in address bar. ";
        } else {
            shareMessageLabel.textContent = " Text buffer too large to share. ";
        }
    };

    if ("onhashchange" in window) {
        window.onhashchange = function () {
            if (ignoreHashChange) { ignoreHashChange = false; return; }
            const queryStringSrcStart = window.location.hash.indexOf("#src=");
            if (queryStringSrcStart == 0) {
                const encoded = window.location.hash.substring("#src=".length);
                try {
                    const text = decodeURIComponent(encoded);
                    if (sampleLoaded) {
                        lhs.editor.getModel().setValue(text);
                    }
                } catch (e) {
                    console.log("unable to parse #src= uri component");
                }
            }
        }
    }

    // Save buffer to localStorage every second if there are changes to model
    if (window.localStorage) {
        let lastVersion: number;
        setInterval(function () {
            if (!sampleLoaded || !editorLoaded)
                return;
            const model = lhs.editor.getModel();
            const version = model.getVersionId();
            if (version !== lastVersion) {
                window.localStorage["src"] = model.getValue();
                lastVersion = version;
            }
        }, 1000);
    }

    function xhr(url: string, complete: (s: XMLHttpRequest) => void, error?: (e: XMLHttpRequest) => void): void {
        var req = new XMLHttpRequest();
        req.onreadystatechange = function () {
            if (req.readyState === 4) {
                if ((req.status >= 200 && req.status < 300) || req.status === 1223) {
                    complete(req);
                } else {
                    error && error(req);
                }
                req.onreadystatechange = function () { };
            }
        };

        req.open("GET", url, true);
        req.responseType = "";

        req.send(null);
    }

})();