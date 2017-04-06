/*
 * Copyright 2017 NAVER Corp.
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

if (navigator.userAgent.includes('sidebar') === false) {
  let a = document.createElement('button');
  a.innerHTML = 'Show sidebar';
  a.style.cssText = `
    position:absolute;
    left:5px;
    top:0;
    width: 250px;
    height: 35px;
    font-size: 15px;
    font-weight: bold;
    z-index: 9999;
    border: 2px solid red;
    color: red;
    box-sizing: border-box;
  `;
  document.body.appendChild(a);
  a.addEventListener('click', () => {
    whale.runtime.sendMessage('sidebarAction.show');
  }, false);

  let c = document.createElement('button');
  c.innerHTML = 'Show sidebar in new window';
  c.style.cssText = `
    position:absolute;
    left:5px;
    top:40px;
    width: 250px;
    height: 35px;
    font-size: 15px;
    font-weight: bold;
    z-index: 9999;
    border: 2px solid green;
    color: green;
    box-sizing: border-box;
  `;
  document.body.appendChild(c);
  c.addEventListener('click', () => {
    whale.runtime.sendMessage('sidebarAction.show2');
  }, false);

  let b = document.createElement('button');
  b.innerHTML = 'Hide sidebar';
  b.style.cssText = `
    position:absolute;
    left:5px;
    top:80px;
    width: 250px;
    height: 35px;
    font-size: 15px;
    font-weight: bold;
    z-index: 9999;
    border: 2px solid blue;
    color: blue;
    box-sizing: border-box;
  `;
  document.body.appendChild(b);
  b.addEventListener('click', () => {
    whale.runtime.sendMessage('sidebarAction.hide');
  }, false);

  let d = document.createElement('button');
  d.innerHTML = 'Hide all sidebars';
  d.style.cssText = `
    position:absolute;
    left:5px;
    top:120px;
    width: 250px;
    height: 35px;
    font-size: 15px;
    font-weight: bold;
    z-index: 9999;
    border: 2px solid black;
    color: black;
    box-sizing: border-box;
  `;
  document.body.appendChild(d);
  d.addEventListener('click', () => {
    whale.runtime.sendMessage('sidebarAction.hideAll');
  }, false);
}

