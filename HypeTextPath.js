/*!
 * Hype TextPath Extension
 * Copyright (2019-2024) Max Ziebell, (https://maxziebell.de). MIT-license
 */

/*
 * Version-History
 * 1.0.0 Released under MIT 
 * 1.0.1 Converted to extension
 * 1.0.2 Added dynamic handling for IDE
 * 1.0.3 Refactored data attributes and simplified logic
 * 1.0.4 Restored local mutation observer for stroke-dashoffset updates
 * 1.0.5 Ensured both IDE and preview versions work correctly
 * 1.0.6 Handled text updates and garbage collection in IDE
 * 1.0.7 Enhanced text updates and improved garbage collection
 * 1.0.8 Added global observer for innerhtml updates
 * 1.0.9 Enhanced global handling of innerhtml updates
 * 1.1.0 Refactored data attributes and enabled pointer events for text path in IDE
 * 1.1.1 Added cleanup function for existing text paths in IDE
 * 1.1.2 Added global observer for style changes
 * 1.1.3 Improved cleanup to avoid text duplication and fixed attribute handling
 * 1.1.4 Added fontWeight, fontStyle, textDecoration to transferStyles as suggested by Jonathan
 */

// Ensure the extension isn't redefined
if ("HypeTextPath" in window === false) {
    window['HypeTextPath'] = (function () {

        const _isHypeIDE = window.location.href.indexOf("/Hype/Scratch/HypeScratch.") != -1;
        const mutationObservers = new WeakMap();

        function HypeSceneLoad(hypeDocument, element, event) {
            processTextPath(element);
        }

        function cleanupExistingTextPaths(sceneElm) {
            var existingTextPaths = sceneElm.querySelectorAll('[data-text-path] text');
            existingTextPaths.forEach(function (textPathElm) {
                textPathElm.parentElement.removeChild(textPathElm);
            });
        }

        function processTextPath(sceneElm) {
            if (_isHypeIDE) {
                cleanupExistingTextPaths(sceneElm);
            }

            var nElmAll = sceneElm.querySelectorAll('[data-text-path]');
            nElmAll.forEach(function (nElm) {
                var textPathID = nElm.dataset.textPath;
                if (textPathID) {
                    const nElmSVG = nElm.querySelector('svg');
                    processTextPathElement(nElmSVG, sceneElm, textPathID);
                }
            });

            if (_isHypeIDE) {
                setupGlobalMutationObserver(sceneElm);
            }
        }

        function processTextPathElement(nElm, sceneElm, textPathID) {
            var tElm = sceneElm.querySelector('[data-text-content="' + textPathID + '"]');
            var pElm = nElm.querySelector('path');

            // Check if both elements are present
            if (!tElm || !pElm) {
                return;
            }

            // Remove any existing text element to prevent duplication
            var existingTextElm = nElm.querySelector('text');
            if (existingTextElm) {
                existingTextElm.parentElement.removeChild(existingTextElm);
            }

            if (!_isHypeIDE) {
                pElm.style.opacity = 0;
                tElm.style.opacity = 0;
                pElm.style.pointerEvents = 'none';
            }

            var nsSvg = "http://www.w3.org/2000/svg";
            var nsXlink = 'http://www.w3.org/1999/xlink';
            var svgtElm = document.createElementNS(nsSvg, "text");
            var svgtpElm = document.createElementNS(nsSvg, "textPath");
            svgtElm.appendChild(svgtpElm);

            svgtpElm.textContent = tElm.querySelector('innerhtmldiv') ? tElm.querySelector('innerhtmldiv').textContent : tElm.textContent || tElm.innerText;

            transferStyles(tElm, svgtElm);
            adjustLayoutBasedOnFontSize(nElm, svgtElm);

            svgtpElm.setAttributeNS(nsXlink, 'xlink:href', '#' + pElm.id);
            svgtpElm.setAttribute('href', '#' + pElm.id);
            setStartOffset(pElm, svgtpElm);

            nElm.appendChild(svgtElm);

            if (_isHypeIDE) {
                svgtElm.style.pointerEvents = 'none';
                svgtElm.style.webkitUserSelect = 'none';
                svgtpElm.style.pointerEvents = 'none';
                svgtpElm.style.webkitUserSelect = 'none';
            }

            setupMutationObserver(pElm, svgtpElm);
        }

        function transferStyles(sourceElm, targetElm) {
            var keys = ['fontFamily', 'fontSize', ['color', 'fill'], 'letterSpacing', 'wordSpacing', 'fontWeight', 'fontStyle', 'textDecoration'];
            keys.forEach(function (key) {
                var isArray = Array.isArray(key);
                var hKey = isArray ? key[0] : key;
                var vKey = isArray ? key[1] : key;
                targetElm.style[vKey] = sourceElm.style[hKey];
            });
        }

        function adjustLayoutBasedOnFontSize(nElm, svgtElm) {
            var buffer = parseInt(svgtElm.style.fontSize);
            nElm.style.setProperty('padding', buffer + 'px', 'important');
            nElm.style.setProperty('margin-left', '-' + buffer + 'px', 'important');
            nElm.style.setProperty('margin-top', '-' + buffer + 'px', 'important');
            nElm.style.setProperty('overflow', 'visible', 'important');
        }

        function setStartOffset(path, textPath) {
            if (typeof path.getAttribute('stroke-dasharray') === 'string') {
                var p = Number(path.getAttribute('stroke-dashoffset'));
                var l = path.getTotalLength();
                textPath.setAttribute('startOffset', ((1 - p / l) * 100).toFixed(2) + '%');
            }
        }

        function setupMutationObserver(path, textPath) {
            var mutationObserver = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    if (mutation.type === 'attributes') {
                        if (mutation.attributeName === 'stroke-dashoffset') {
                            setStartOffset(mutation.target, textPath);
                        }
                    }
                });
            });

            mutationObserver.observe(path, {
                attributes: true,
                attributeFilter: ['stroke-dashoffset']
            });
            mutationObservers.set(path, mutationObserver);
        }

        function setupGlobalMutationObserver(sceneElm) {
            var globalMutationObserver = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    var node = mutation.target;

                    // Handle data-text-path or data-text-content attribute changes
                    if (mutation.type === 'attributes') {
                        var textPathID = node.dataset.textPath || node.dataset.textContent;

                        // Clean up previous associations if attributes are changed
                        if (mutation.oldValue && (mutation.attributeName === 'data-text-path' || mutation.attributeName === 'data-text-content')) {
                            cleanupTextPath(sceneElm, mutation.oldValue);
                        }

                        if (textPathID) {
                            const nElmSVG = sceneElm.querySelector(`[data-text-path="${textPathID}"] svg`);
                            if (nElmSVG) {
                                processTextPathElement(nElmSVG, sceneElm, textPathID);
                            }
                        }
                    }

                    // Update text path content
                    if (mutation.attributeName === 'data-text-content') {
                        updateTextPathContent(sceneElm, node);
                    }

                    // Handle child list changes
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1) { // Only element nodes
                                if (node.dataset.textPath || node.dataset.textContent) {
                                    var textPathID = node.dataset.textPath || node.dataset.textContent;
                                    const nElmSVG = node.querySelector('svg');
                                    processTextPathElement(nElmSVG, sceneElm, textPathID);
                                }
                            }
                        });
                        mutation.removedNodes.forEach(node => {
                            if (node.nodeType === 1) { // Only element nodes
                                var paths = node.querySelectorAll('path');
                                paths.forEach(path => {
                                    var observer = mutationObservers.get(path);
                                    if (observer) {
                                        observer.disconnect();
                                        mutationObservers.delete(path);
                                    }
                                });
                            }
                        });
                    }

                    // Update content of text paths when inner HTML changes
                    if (node.classList.contains('HYPE_InnerHTML_Div')) {
                        var textPathID = node.closest('[data-text-content]')?.dataset.textContent;
                        if (textPathID) {
                            updateTextPathContent(sceneElm, node.closest('[data-text-content]'));
                        }
                    }

                    // Update styles on style attribute changes
                    if (mutation.attributeName === 'style') {
                        var textPathID = node.closest('[data-text-content]')?.dataset.textContent;
                        if (textPathID) {
                            var tElm = node.closest('[data-text-content]');
                            var svgtElm = sceneElm.querySelector(`[data-text-path="${textPathID}"] text`);
                            if (tElm && svgtElm) {
                                transferStyles(tElm, svgtElm);
                            }
                        }
                    }
                });
            });

            globalMutationObserver.observe(sceneElm, {
                attributes: true,
                subtree: true,
                attributeOldValue: true,
                attributeFilter: ['data-text-path', 'data-text-content', 'stroke-dashoffset', 'style'],
                childList: true,
                characterData: true
            });
        }

        function updateTextPathContent(sceneElm, tElm) {
            var textPathID = tElm.dataset.textContent;
            var innerHtmlNode = tElm.querySelector('innerhtmldiv');
            var textContent = innerHtmlNode ? innerHtmlNode.textContent : tElm.textContent || tElm.innerText;

            var textPathElm = sceneElm.querySelector(`[data-text-path="${textPathID}"] textPath`);
            if (textPathElm) {
                textPathElm.textContent = textContent;
            }
        }

        function cleanupTextPath(sceneElm, textPathID) {
            var textPathElm = sceneElm.querySelector(`[data-text-path="${textPathID}"] textPath`);
            if (textPathElm) {
                textPathElm.parentElement.removeChild(textPathElm);
            }
        }

        if ("HYPE_eventListeners" in window === false) {
            window.HYPE_eventListeners = Array();
        }
        window.HYPE_eventListeners.push({"type": "HypeSceneLoad", "callback": HypeSceneLoad});

        if (_isHypeIDE) {
            document.addEventListener('DOMContentLoaded', function () {
                setTimeout(function () {
                    processTextPath(document.body);
                }, 100);
            });
        }

        return {
            version: '1.1.3'
        };
    })();
}
