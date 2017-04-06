/*
 * Copyright 2017 NAVER Corp.
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

(function () {
  'use strict';

  whale.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(message);
  });

  /* sidebarAction.getTitle() / sidebarAction.setTitle() */
  let defaultTitle;
  whale.sidebarAction.getTitle((result) => {
    defaultTitle = result;
  });
  document.getElementById('setTitle1').addEventListener('click', () => {
    whale.sidebarAction.setTitle({
      title: 'ABC'
    });
  }, false);
  document.getElementById('setTitle2').addEventListener('click', () => {
    whale.sidebarAction.setTitle({
      title: defaultTitle
    });
  }, false);

  /* sidebarAction.getBadgeText() / sidebarAction.setBadgeText() */
  let badgeCnt = 0;
  document.getElementById('setBadgeText1').addEventListener('click', () => {
    badgeCnt ++;
    whale.sidebarAction.setBadgeText({
      text: badgeCnt + ''
    });

    whale.sidebarAction.setBadgeBackgroundColor({
      color: '#'+Math.floor(Math.random()*16777215).toString(16)
    });
  }, false);
  document.getElementById('setBadgeText2').addEventListener('click', () => {
    badgeCnt = 0;
    whale.sidebarAction.setBadgeText({
      text: ''
    });
  }, false);

  /* whale.sidebarAction.onClicked.addListener() */
  whale.sidebarAction.onClicked.addListener((result) => {
    document.getElementById('clicklog').innerHTML += 'windowId:' + result.windowId + ', ' + (result.opened ? 'sidebar OPENED' : 'sidebar CLOSED') + '<br/>';
  });
})();
