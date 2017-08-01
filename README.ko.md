## 웨일 확장앱이란 무엇인가?
**extension을 확장앱으로 번역했습니다

웨일 확장앱은 웨일 브라우저의 기능을 강화하는 작은 소프트웨어들입니다. 

웨일 확장앱은 기본적으로 크롬 확장앱(https://developer.chrome.com/extensions)의 구조를 공유하고, 구글 확장 API (https://developer.chrome.com/extensions/api_index)와 모두 호환됩니다. ‘chrom.*’ 네임스페이스를 사용하는 대신에 웨일확장앱은 ‘whale.*’이라는 네임스페이스로 모든 확장기능에 접근하도록 제공다.

```javascript
whale.runtime.XXX
whale.bookmakrs.XXX
whale.browserAction.XXX
whale.windows.XXX
whale.tabs.XXX
whale.storage.XXX
...
```

## 사이드 바?

사이드바는 확장앱의 하나의 기능이면서 브라우저의 한쪽 면에서 나오는 웹 패널(슬라이드바가 속한 부분)입니다. 사용자는 다양한 확장앱과 사이드 바의 웹 패널을 자신의 요구대로(자신이 원하는 대로) 추가할 수 있습니다.

![NCapture005.PNG](docs/f6ad8410-0808-11e7-8942-1cab765a9168.png)

사이드 바의 확장과 웹 패널은 웨일 브라우저의 같은 공간을 공유하지만(같은 공간에서 동작하지만) 다음과 같은 다른 점들이 있다 :
  * 웹 패널은 브라우저 UI를 통해 더해지지만 사이드 바 확장앱은 확장앱 설치를 통해서 더해진다.

![NCapture008.PNG](docs/7b2e651a-0809-11e7-8d33-7fe5093d0132.png)

  * 웹 패널은 웹 상의 리소스를 HTTP와 HTTPS를 통해 원격으로 서버에서 로드하지만(가져오지만), 사이드 바는 확장 앱 패키지에서 설치된 로컬 리소스를 로드합니다(가져옵니다).

![NCapture007.PNG](docs/989e7932-0809-11e7-908c-7e3b96867080.png)

  * ● 웹 패널은 네비게이션 메뉴를 제공하여, 사용자가 전에 웨일 브라우저에서 웹서핑하던 곳으로 되돌아갈 수 있습니다. (내비게이션 메뉴를 제공하여 웹서핑을 할 때, 이전 페이지나 앞의 페이지로 이동할 수 있습니다 – 웹의 뒤로 가기 앞으로 가기 기능을 제공해 줍니다.) 


마지막으로 사이드 바의 경계에 마우스포인터를 놓으면 사이드 바의 너비은 390픽셀에서 590픽셀까지 조절할 수 있습니다.

![NCapture009.PNG](docs/1765d6e4-0809-11e7-89ee-d88ac06318be.png)

## 다음은?
이제 웨일 확장앱이 어떻게 보이고, 어떻게 설치되는지, 어디에 설치되는지 압니다. 이제는 어떻게 구축되었는지를 살펴보겠습니다.

### 파일
각 확장앱에는 다음의 파일이 있습니다. :

* 매니페스트파일
* 하나 혹은 더 많은 html파일들 (확장앱이 사이드 바 확장앱인 경우에, html파일은 필수 사항)
* 선택 사항 : 하나 이상의 자바스크립트 파일
* 선택 사항 : 확장앱에서 필요한 다른 파일들(ex. 이미지파일 등)

### 사이드바의동작
만약 당신이 사이드 바 확장앱을 만들길 원한다면, 너는 매니 페스트 파일에서 사이드 바 액션(동작)을 선언해주어야 합니다.
```javascript
{
  ...
  "sidebar_action": {
    "default_icon": {                      // required
      "16": "images/icon16.png"
    },
    "default_page": "popup.html",          // required
    "default_title": "Sidebar Extension",   // optional; shown in tooltip
    "use_navigation_bar": true   // optional; true is default
  }
  ...
}
```
[whale.sidebarAction](https://github.com/naver/whale-developers/wiki/whale.sidebarAction) 인터페이스는 사이드 바 확장앱을 조작할 수 있는 강력한 API를 제공합니다.

### 크롬 확장앱 개요
마지막으로, 크롬 확장앱 개발자 가이드(https://developer.chrome.com/extensions/overview)에는 당신이 흥미로워할만한 서류에 대한 수십개의 추가적인 링크들이 있다. 당신은 크롬 확장앱 API(https://developer.chrome.com/extensions/api_index) 및 패키징(https://developer.chrome.com/extensions/packaging) 사양을 사용할 수 있습니다.

## 더읽을거리
* [How to avoid my extension from changing urls](https://github.com/naver/whale-developers/wiki/How-to-avoid-my-extension-from-changing-urls)
* [Client-side-application-vs-Server-side-application](https://github.com/naver/whale-developers/wiki/Client-side-application-vs-Server-side-application)
* [Testing and debugging my extension](https://github.com/naver/whale-developers/wiki/How-to-test-and-debug-my-extension)
* [Registering my whale extension](https://store.whale.naver.com/developers)
