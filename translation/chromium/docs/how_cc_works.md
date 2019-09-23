# How cc Works

[Original google doc](https://docs.google.com/document/d/1yjzOWrPfFGviEd1nru3yzqxSHETC-zsEBSt9C8SvV-Q/edit)

[Chinese translation](https://zhuanlan.zhihu.com/p/54601110)

[TOC]

## tl;dr

[cc/](https://cs.chromium.org/chromium/src/cc/) 는 역사적이지만 정확하지 않은 크롬 컴포지터라고 불렸습니다.
그것은 "그" 크롬 컴포지터가 아니고 (물론 많이 존재 하지만), 더 이상 컴포지터도 아닙니다.
danakj 는 "컨텐트 조합자(content collator)" 라는 대안 이름을 제안 했습니다.

cc 는 브라우저 프로세스 안에서 ui/compositor 혹은 안드로이드 코드를 통해, 그리고 유틸리티 프로세스 안에서 ui/compositor 를 통해
임베딩 됩니다.
그것은 Blink / RenderWidget 을 통해서 렌더러 프로세스 안에도 임베딩 됩니다.
cc 는 임베더로부터 페인트 입력(painted inputs) 을 가져와서, 위치를 알아내고 만약 화면에 나타난다면,
페인트 입력으로 부터 gpu 텍스쳐로 이미지를 레스터라이즈 하고, 디코딩하고, 애니매이팅 해서 컴포지터 프레임의 형태로,
텍스쳐들을 디스플레이 컴포지터에 전달 합니다.
cc 는 또한 Blink 를 거치지 않고 브라우저 프로세스로 부터 전달되는 핀치와 스크롤 제스쳐와 같은 입력을 응답성있게 처리 합니다.

## Process / thread architecture

cc 는 단일 쓰레드 혹은 멀티 쓰레드로 임베딩 될 수 있습니다.
단일 쓰레드 버전은 오버헤드가 적습니다.
멀티 쓰레드 버전은 지연 비용이 발생하지만, 입력과 애니매이션이 다른 쓰레드가 바쁘 더라도 하나의 쓰레드에서 응답성 있게 처리될
수 있도록 합니다.
일반적으로, 브라우저는 메인 쓰레드가 비용이 적고 가벼워서 단일 쓰레드로 사용하지만, 렌더러는 (Blink) 메인 쓰레드가 어떤 페이지에서는
아주 바쁘기 때문에 멀티 쓰레드를 사용합니다.

단일 그리고 멀티 쓰레드 버전 모두 [cc::Scheduler](#scheduling) 를 사용하도록 하며, 프레임들을 언제 보낼지 결정 합니다.
한 가지 예외는(오직 한 곳에서만 사용하는 세번째 모드) Blink 레이아웃 테스트와 sim 테스트 이며, (항상) 스케쥴러를 사용하지 않고,
LayerTreeHost::Composite 를 통해서 언제 동기로(synchronously) 컴포지트를 할지 cc 에게 알려줍니다.
이것은 역사적인 이유이며, 또한 테스트 하는 동안 더 많은 제어를 합니다.

## Content Data Flow Overview

![data flow diagram](images/how_cc_works-data_flow.png)

임베더가 사용하는 cc 의 주요 인터페이스는 (다양한 LayerTreeSettings 에 의해 생성되는) LayerTreeHost 이며, [레이어들](#layers) 의  [트리](#trees-commit-activation) 입니다.
하나의 레이어는 컨텐트에 해당하는 하나의 사각형이며, 화면에 컨텐트가 어떻게 보여져야 하는지에 대한 다양한 속성을 포함 합니다.
cc 는 컨텐트에 대한 페인트된 표현 (예, PaintRecord) 을 레스터라이즈된 표현 (소프트웨어 비트맵 혹은 gpu 텍스쳐) 으로 변환하고, 화면에 보일 사각형의 위치를 알아냅니다.

cc 는 이 레이어 트리를 PropertyTreeBuilder 를 통해 하나의 프로퍼티 트리(property trees) 집합으로 변환하고, 레이어 트리를 보여지는 레이어들에 대한 순서있는 리스트로 단순화 합니다.
slimming paint 프로젝트의 일부로, Blink 는 훨씬 이전의 레이어 트리 인터페이스를 통하지 않고, 직접 프로퍼티 트리와 레이어 리스트를 설정하며, 파이프라인에서 이 부분의 작업은 피할 것 입니다.

[커밋 프로세스](#commit-flow) 동안, cc 는 모든 메인 쓰레드 자료구조들로 부터의 입력을 컴포지터 쓰레드의 자료구조로들로 전달 합니다.
이 시점에, cc 는 각 레이어의 어떤 영역들이 보여야 하는지 결정하고 이미지 디코드하고 [컨텐트를 레스터](#raster-and-tile-management) 하는 단계를 진행 합니다.

불행하게도 cc 는 아직 여러 곳에서 "draw" 와 "swap" 이라는 용어를 사용하는데, 둘 다 그에 해당하는 일은 하지 않습니다.
cc 에서 "draw" 는 최종적으로 화면에 그려질 쿼드(quads) 와 렌더 패스(render passes) 로 채워진 [컴포지터 프레임](#compositor-frames-render-passes-quads) 을 생성하는 것을 의미 합니다.
cc 에서 "swap" 은 CompositorFrameSink 을 통해 생성한 프레임을 디스플레이 컴포지터(display compositor) 에 제출하는 것을 의미 합니다.
이 프레임들은 SurfaceAggregator 로 보내지는데, 모든 프레임 생성자들로 부터 보내진 컴포지터 프레임들이 모두 모아지는 곳 입니다.

## Input Data Flow Overview

cc 의 다른 주요 입력은 클릭, 마우스 휠, 터치 제스처와 같은 사용자 입력 입니다.
렌더러 프로세스에서, 입력은 브라우저 프로세스로 부터 전달 됩니다. 
그것은 ui::InputHandlerProxy (a cc::InputHandlerClient) 에 의해 처리 됩니다.

이 입력의 일부는 특정 시간마다 LayerTreeHostImpl (a cc::InputHandler) 로 전달 됩니다.
이것은 활동중인 레이어의 속성 트리를 수정하고 필요에 따라 스크롤이나 핀치 할 수 있도록 합니다.
일부 입력은 컴포지터 쓰레드에 의해 처리될 수 없고 (예. 동기로 동작하는 자바스크립트 터치 혹은 휠(wheel) 핸들러), Blink 에서 직접 처리하도록 전달 됩니다.
이 입력 흐름은 이전 절에서의 컨텐트 데이터 경로와 반대로 갑니다.

## Commit Flow

커밋은 메인 쓰레드에서 컴포지터 쓰레드로 데이터를 원자적으로 받는 방법 입니다.
(단일 쓰레드 모드로 실행 하더라도, 이 작업을 수행하여 데이터를 올바른 자료구조로 옮깁니다.) IPC 로 보내기 보단, 메인 쓰레드를 멈추고 데이터를 복사해서 넘김으로써 커밋이 완료 됩니다.

![commit flow diagram](images/how_cc_works-commit_flow.png)

메인 쓰레드는 몇 가지 방법으로 커밋을 요청할 수 있습니다.
대부분 웹페이지는 requestAnimationFrame 를 통해 요청하는데, 결국 LayerTreeHost 의 SetNeedsAnimate 를 호출 합니다.
추가적으로, 어떤 cc 의 입력이든 수정하면 (예. 트랜스폼(transform)과 같은 레이어 속성이나 레이어 컨텐트의 변경) 역시 LayerTreeHost 의 SetNeedsAnimate, SetNeedsUpdate, 혹은 SetNeedsCommit 을 호출 합니다.
다른 SetNeeds 함수들은 필요한 작업이 정해지지 않으면 그 커밋에 대한 다른 수준의 조기 중단을 허용 합니다.
(예를 들면, requestAnimationFrame 의 콜백이 아무일도 안하면, 커밋할 필요가 없거나 레이어를 갱신할 필요가 없습니다.) 이 모든 함수들은 현재 아무것도 하고 있지 않으면, 스케줄러에게 BeginMainFrame 을 요청 합니다.

어떤 시점에서, 스케줄러는 ScheduledActionBeginMainFrame 으로 응답 합니다.
이것은 BeginMainFrame 을 시작하기 위해, 컴포지터 쓰레드로 부터 BeginFrameArgs 을 메인 쓰레드로 보냅니다.
BeginFrameArgs 은 (애니매이션을 위한) 시간과 스크롤 증분(scroll deltas)을 포함하는데, (주로 사용자의 제스쳐를 처리한 결과로써) 컴포지터 쓰레드에는 적용 되었지만 Blink 는 알지 못합니다.
Blink 가 cc 를 임베딩 하고 있을 때, 어떤 컴포지터 스크롤 증분이던 BeginMainFrame 을 Blink 에 적용하고, requestAnimationFrame 로직을 시작하며, Blink [렌더링 생명주기](https://docs.google.com/document/d/1aitSOucL0VHZa9Z2vbRJSyAIsAz24kX8LFByQ5xQnUg/edit#) 의 반을 끝냅니다.

이것이 끝나면, cc 는 모든 레이어를 업데이트 합니다.
이 업데이트 파이프라인에서 어떤 지점이던 cc 가 요구한 작업이 없다고 결정하면(예. 컴포지터 쓰레드 스크롤이 Blink 를 업데이트 하려고 하는데, 그 스크롤에 대해 페이지 변경이 없는 경우), 커밋을 조기에 종료할 것 입니다.
(현재 단일 쓰레드로 동작하는 cc 는 커밋을 결코 중단하지 않습니다.) 임베더가 BeginMainFrame 작업을 끝냈고, 그 커밋이 중단되지 않았다면, ProxyMain 는 NotifyReadyToCommit 를 동기 호출하고 컴포지터 쓰레드에 뮤텍스를 전달하면서 중단(block) 상태가 됩니다.

스케쥴러가 커밋할 준비가 돠면, ScheduledActionCommit 로 응답할 것 입니다.
그때 컴포지터 쓰레드의 ProxyImpl 은 (블럭되어 있는 동안) 메인 쓰레드로 부터의 데이터를 컴포지터 쓰레드 자료구조로 복사하는 모든 작업을
수행 합니다.
그러면 메인 쓰레드가 계속 진행할 수 있도록 뮤텍스를 릴리즈 합니다.

ProxyImpl 은 메인 쓰레드와 컴포지터 쓰레드의 자료구조들을 모두 접근 할 수 있는 유일한 클래스 입니다.
메인 쓰레드가 블럭될 때 메인 쓰레드의 LayerTreeHost 와 레이어들만 접근할 수 있으며, 이것을 접근하는 메서드 안에서 DCHECK 을 통해 강제 합니다.
ProxyMain 은 메인 쓰레드에서 대응되는 것이며 LayerTreeHost 에 의해 소유 됩니다.
단일 쓰레드의 경우, SingleThreadProxy 가 ProxyMain 와 ProxyImpl 둘 모두의 작업을 수행 합니다.

## Layers

레이어는 컨텐트에 대한 2차원 사격형으로 정수값의 경계를 갖습니다.
이것은 화면에 어떻게 보여져야 하는가에 대한 설명이라고 할 수 있는 변환, 클립, 효과들을 포함 합니다.

레이어에 대한 두 개의 클래스 계층이 있는데, 하나는 메인 쓰레드 레이어 트리 (cc::Layer 로 부터 파생되는) 이고,
다른 하나는 컴포지터 쓰레드 펜딩, 액티브, 리사이클 레이어 트리 (cc::LayerImpl 로 부터 파생되는) 입니다.
대략 1:1 대응관계가 있는데 SurfaceLayer 와 SurfaceLayerImpl 혹은 PictureLayer 와 PictureLayerImpl 와
같은 것들 입니다. 이 섹션에서는 대부분 이 쌍에 대해 이야기 합니다.

메인 쓰레드에서, 레이어들은 레퍼런스 카운팅 됩니다.
LayerTreeHost 는 루트 레이어를 소유하고, 각 레이어는 재귀적으로 그들의 자식들을 소유 합니다.
Blink 의 어떤 부분들은 역시 레이어들을 제공 하는데, (예, surface 와 비디오 레이어를 생성하는 미디어 시스템, 플러그인들) 이것이 러퍼런스 카운틴되는 이유 입니다.
컴포지터 쓰레드에서, 레이어들은 그들의 부모들에 의해 unique_ptr 로 소유 됩니다.

### Property Trees

cc 에서 계층적인 속석들을 기술하는 두가지 방식이 있습니다.
역사적인 방식은 (그리고 ui/ 가 이것을 다루는 방식) 레이어들의 트리를 제공하는 것압니다.
부모 레이어가 변환 (예, translate, scale, perspective), 클립, 효과 (예, blur, filter, mask, opacity) 를 갖게 되면, 재귀적으로 구들의 자식들에게 적용 됩니다.
이러한 추상화 방식은 많은 [코너 케이스들](https://docs.google.com/presentation/d/1V7gCqKR-edNdRDv0bDnJa_uEs6iARAU2h5WhgxHyejQ/edit#slide=id.g1c810b6196_0_68) (고정된 위치를 갖는 레이어들, 스크롤 부모, 스크롤 자식들) 을 갖고 있고, 성능이 좋지 않습니다. (매우 큰 트리를 순회해야 하고 매 단계마다 모든 속성들을 계산해야 함)

[속성 트리](https://docs.google.com/presentation/d/1V7gCqKR-edNdRDv0bDnJa_uEs6iARAU2h5WhgxHyejQ/edit?usp=sharing) 가 이것을 해결하는 방법 입니다.
대신, cc 는 속성들에 대한 개별 트리들이 제공 됩니다: 변환(transform) 트리, 클립(clip) 트리, 효과(effect) 트리.
각 레이어는 그 레이어가 사용하는 변환, 클립, 효과 노드에 대한 노드 아이디를 갖고 있습니다.
이와 같은 방식으로, 업데이트는 O(레이어의 수) 가 아닌 O(관심있는 노드들) 이 됩니다.
속성트리가 있다면, 더 이상 레이어 트리는 필요하지 않으며, 대신 레이어들의 정렬된(ordered) 리스트가 사용될 수 있습니다.

### PictureLayer

하나의 레이어는 페인트된 컨텐트(painted content)를 포함 합니다.
이 컨텐트는 cc::PaintRecord 의 형태로 제공 됩니다.
PictureLayer 는 컨텐트가 어떤 배율(scale)로 레스터 되는것이 좋은지 알아 냅니다.
각 배율은 PictureLayerTiling 으로 표현되는데, 특정 배율의 컨텐트에 대한 sparse 2d regular tiling 입니다.

이 tiling 안에 있는 각 타일은 cc::Tile 인데, 잠재적인 컨텐트와 그들의 [TileManager 에 의해 조율되는 레스터라이제이션](#raster-and-tile-management) 을 나타 냅니다.
만약 [DevTools 렌터링 설정에서](https://developer.chrome.com/devtools/docs/rendering-settings) composited layer borders 설정을 켠다면, 타일 테두리들을 볼 수 있습니다.
타일 크기를 결정하는데는 몇가지 휴리스틱이 있는데, 소프트웨어 레스터 타일들은 대략 256x256 px 이고, gpu 레스트 타일들은 대략 viewport width x (viewport height * 1/4) 입니다. 

레스터라이제이션 배율을 언제 어떻게 변경할지를 결정하는 몇가지 휴리스틱도 있습니다.
완벽하진 않지만, 위험을 감수하고 변경 합니다.
🐉🐉🐉

### PictureImageLayer

PictureLayer 의 서브 클래스.
Blink 에서 합성된 이미지들(composited images)에 대한 특별한 케이스 입니다.
이미지가 합성된 레이어를 갖게 되지만 테두리나 패딩이 없다면 (예, 페인트된 컨텐트는 이미지와 완전히 동일함) 일부 작업들이 여기서 절약될 수 있습니다.
이미지를 고정 스케일들로 레스터화 하는데, 이렇게 이미지를 스케일링 하는것이 성능에 유리합니다.
이것은 소프트웨어 레스터에서 많은 부분 절약을 하는데, gpu 레스터에서 이런 레이어들은 결코 생성되지 않습니다.

### TextureLayer

플러그인들, 자체적으로 레스터하는 캔버스, WebGL 에서 사용됨.
여기서 "텍스쳐"는 gpu 텍스쳐에 대한 참조를 말하지만, 소프트웨어 컴포지팅에서는 공유 메모리 비트맵을 의미 합니다.

### SolidColorLayer

레이어가 단지 단색으로 알려져 있다면 래스터 작업이나 gpu 메모리를 사용할 필요가 없습니다.
이것은 레이어의 컨텐트가 단순하다는 것을 알게됐을 때 수행되는 최적화 입니다.

### VideoLayer

[surfaces for video project](https://docs.google.com/document/d/1tIWUfys0fH2L7h1uH8r53uIrjQg1Ee15ttTMlE0X2Ow/edit) 의 일부로써 더 이상 사용되지 않습니다.
삭제될 것 입니다.

### SurfaceLayer

서피스 레이어는 서피스 아이디를 갖는데, 시스템에서 다른 컴포지터 프레임의 스트림을 가르킵니다.
이것은 다른 컴포지터 프레임 생산자에 대한 간접 참조를 갖는 방법 입니다.
See also: [surface documentation](https://www.chromium.org/developers/design-documents/chromium-graphics/surfaces).
예를 들면, Blink 는 SurfaceLayer 를 통해 프로세스 밖의 iframe 들(out of process iframes)에 대한 참조를 내장하고(embed) 하고 있습니다.

### SolidColorScrollbarLayer

안드로이드 스크롤바들은 "단일 색상" 스크롤바 레이어들 입니다.
그것들은 단순한 박스이며 텍스쳐 리소스를 생성하지 않고 컴포지터에 그려질 수 있습니다.
단일 색상과 칠해진(painted) 스크롤바 레이어들이 있기 때문에 컴포지터 쓰레드에서의 스크롤링은 메인쓰레드에 갔다오지 않고 응답성 있게 스크롤바 업데이트를 할 수 있습니다.
이것이 없다면, 페이지 스크롤은 부드럽게 되는 반면 스크롤 바는 튀어 다닐 수 있습니다.

### Painted(Overlay)ScrollbarLayer

(안드로이드가 아닌) 데스크탑 스크롤바들은 칠해진(painted) 스크롤바들 입니다.
테마 코드는 쓰레드에 안전하지 않기 때문에, thumb 과 track 은 메인쓰레드에서 칠해지고 비트맵으로 레스트 됩니다.
그 다음, 이 비트맵들은 컴포지터 쓰레드로 쿼드들로써 보내집니다.
ChromeOS 는 PaintedOverlayScrollbarLayer 를 사용하는데, 나인패치(nine-patch) 비트맵 버전 입니다.

### HeadsUpDisplayLayer

이 레이어는 [devtools rendering settings](https://developer.chrome.com/devtools/docs/rendering-settings) 을 지원 합니다.
그것은 FPS meter 와 paint invalidation 이나 damage 를 위한 오버레이를 그립니다.
이 레이어는 특별하게도 나중에 업데이트 되어야 합니다. 왜냐하면 입력들이 다른 레이어들의 damage 계산에 의존하기 때문 입니다.

### UIResourceLayer / NinePatchLayer

UIResourceLayer 는 TextureLayer 와 동등한 소프트웨어 비트맵 입니다.
그것은 비트맵 업로드를 처리하며 컨텍스트를 잃었을 때 필요에 따라 비트맵을 다시 생성합니다.
NinePatchLayer 는 UIResourceLayer 의 파생 클래스로써, UIResource 를 잘늘어나는 조각들로 만듭니다.

## Trees: commit / activation

네 종류의 레이어 트리가 있지만, 특정 시간에는 항상 2 ~ 3개의 레이어 트리가 존재 합니다:

* 메인 쓰레드 트리 (cc::Layers, 메인 쓰레드, 항상 존재함)

* Pending 트리 (cc::LayerImpl, 컴포지터 쓰레드, rasterization 의 스테이징 단계임, 없을 수도 있음)

* Active 트리 (cc::LayerImpl, 컴포지터 쓰레드, drawing 의 스테이징, 항상 존재함)

* Recycle 트리 (cc::LayerImpl, 컴포지터 쓰레드, Pending 트리와 상호 배타적으로 존재함)

역사적으로 "트리" 라고 부르는데, 트리 였으며 cc/trees/ 아래 위치해 있지만, 모두 리스트이며 트리가 아닙니다.
cc::Layers 에 대한 메인 쓰레드 트리는 LayerTreeHost 가 소유 합니다.
cc::LayerImpls 에 대한 pending, active, recycle 트리는 모두 LayerTreeImpl 인스턴스이며, LayerTreeHostImpl 가 소유 합니다.

커밋(commit)은 메인 쓰레드 레이어 리스트에서 레이어 트리와 속성들을 pending 트리로 밀어 넣는 과정 입니다.
활성화(Activation)는 pending 트리에서 레이어 트리와 속성들을 active 트리로 밀어 넣는 과정 입니다.
각 과정들 동안에, 중복된 레이어 구조가 생성됩니다. (동일한 레이어 아이디들, 레이어 타입들, 속성들)
레이어 아이디는 각 트리에서 대응되는 레이어를 찾는데 사용됩니다.
메인 쓰레드 트리에 있는 아이디 5 레이어는 pending 트리의 레이어 아이디 5 로 넘겨질 것 입니다.
pending 레이어는 아이디가 5인 레이어를 active 트리로 넘길 것 입니다.
레이어가 없다면, 넘겨지는 과정에서 생성될 것입니다. 유사하게 넘기는 트리에서 존재하지 않는 레이어는 받는 트리에서 삭제 됩니다.
이 모든 것이 트리 동기화 과정(tree synchronization process)을 통해 수행 됩니다.

Layer(Impl)s 를 할당하는 것은 비용이 크고, 대부분의 레이어트리 구조들은 프레임간에 변화가 없기 때문에,
pending 트리가 활성화 되면, "recycle 트리"가 됩니다.
이 트리는 마지막 pending 트리의 캐시로 사용되는 것 이외에는 결코 쓰이지 않습니다.
이렇게 하면 메인 쓰레드에서 pending 트리로 할당 및 속성 밀어넣기 작업을 피할 수 있습니다.
이는 단지 최적화에 불과합니다.

pending 트리가 존재하는 이유는 만약 하나의 자바스크립트 콜백으로 웹 컨텐트에 대한 많은 변화가 있는 경우 (예, html canvas 에 라인이 그려져 있고, div 가 움직이는 동안 일부 background-color 가 파란색으로 변함), 이 모든 것들이 사용자에게는 단일하게 나타나야 합니다.
커밋은 이런 변화들에 대한 스냅샷을 pending 트리로 밀어 넣고, Blink 는 다음 커밋을 위해 메인 쓰레드 트리를 업데이트 할 수 있습니다.
커밋 이후, 이 변화들은 레스트화 될 필요가 있고, 모든 레스터라이제이션은 이 새로운 타일들이 사용자에게 보여지기 전까지 완료 되어야 합니다.
pending 트리는 모든 비동기 레스터라이제이션 작업이 완료될 때 까지 대기하는 스테이징 영역 입니다.
pending 트리가 모든 레스터라이제이션 작업을 준비하는 동안, active 트리는 애니매이션으로 업데이트 될 수 있고 스크롤에 반영하며 사용자에게 응답성을 유지할 수 있습니다.

cc의 단일 쓰레드 버전은 pending 트리가 없고, 커밋은 active 로 바로 수행 됩니다.
(이 모드에서는 recycle 트리는 사용되지 않습니다.) 이것은 추가 작업과 복사를 피하기 위한 최적화 입니다.
이 문제를 해결하려면, 타일들이 모두 그릴 준비가 될때 까지 active 트리를 그릴 수 없습니다.
그러나 cc 의 단일 쓰레드 버전을 감안하면, 컴포지터 쓰레드 애니메이션도 없고 스크롤도 없기 때문에 그릴 필요가 없습니다.

## Raster and tile management

TileManager 는 타일들을 레스터라이즈 할 책임이 있습니다.
각 PictureLayer 는 레스터라이즈 할 타일 집합을 제공하는데, 각 타일은 특정 배율로 페인트된 컨텐트의 subrectangle 입니다.

TileManager 는 active 트리에서 그려져야 하는 모든 타일들, pending 트리에서 activate 되어야하는 모든 티일들, viewport 에 가까이 있지만 안보이는 덜 중요한 타일들, 그리고 디코딩할 offscreen 이미지들을 찾습니다.

현재 cc 에는 세가지 레스터 모드들이 있습니다:

* 소프트웨어 레스터: raster worker 에서 소프트웨어 비트맵들을 생성 합니다.

* gpu 레스터: 커맨드 버퍼로 gl 커맨드들을 보내서 gpu 텍스쳐를 생성 합니다.

* oop 레스터: 커맨드 버퍼로 paint 커맨드들을 보내서 gpu 텍스쳐를 생성 합니다.

TileManager 는 컴포지터 프레레임들을 보내는(submit) [LayerTreeFrameSink](https://docs.google.com/document/d/1tFdX9StXn9do31hddfLuZd0KJ_dBFgtYmxgvGKxd0rY/edit) 이 context provider 를 갖느냐 갖지 않느냐에 따라 소프트웨어 혹은 하드웨어 레스터를 사용하게 됩니다.
항상 하나의 모드는 다른 모드에 있게 됩니다.
모드를 바꾸면 모든 리소스들을 버리게 됩니다.
GPU 레스터는 현재 사용하지 않으며, 결국 모든 케이스에 대해 OOP (out-of-process) 로 대체될 것 입니다.
모드를 변경하는 흔한 이유는 gpu 프로세스가 너무 많이 죽어서, 모든 Chrome 이 gpu 에서 소프트웨어 레스터 및 컴포지팅 모드로 전환하는 경우 입니다.

TileManager 가 할일들을 결졍하면, 종속성을 포함하는 TaskGraph 를 생성하고 워커 쓰레드를 통해 작업을 스케쥴링 합니다.
TaskGraph 는 동적으로 업데이트 되지 않고, 대신 전체 그래프가 재스케쥴링 됩니다.
작업들을 일단 시작하면 취소 되지 안습니다.
아직 시작하지 않은 스케쥴링된 작업은 해당 작업이 포함되지 않은 다른 그래프를 생성함으로써 취소 됩니다.

### Image Decoding

TileManager 는 이미지 디코딩에 대해 많은 신경을 씁니다. 레스트에서 가장 비용이 큰 부분이고, 특히 비교적 빠른 gpu 레스트와 관련이 있습니다.
각 디코드는 작업 그래프에서 자체적인 종속 작업을 받습니다.
소프트웨어 레스트와 gpu 레스트를 위한 독립된 디코드 캐쉬가 있습니다.
SoftwareImageDecodeCache 는 디코드, 스케일, 컬러 보정을 관리하는 반면, GpuImageDecodeCache 는 이 텍스쳐들을 gpu 프로세스로 업로드 하고 [gpu discardable memory](https://docs.google.com/document/d/1LoNv02sntMa7PPK-TZTuMgc3UuWFqKpOdEqtFvcm_QE/edit) 에 저장 합니다.

cc 역시 Chrome 에서 animated gifs 의 모든 애니매이션을 처리 합니다.
gif 애니매이션이 시작되면, 일부 레스터 무효화(raster invalidation)와 함께 새로운 pending 트리를 생성하고, 해당 gif 가 커퍼하는 타일들을 다시 레스트 합니다.

### Raster Buffer Providers

소프트에어 vs 하드웨어 레스터 모드와 별개로, Chroem 은 소프트웨어 vs 하드웨어 디스플레이 컴포지팅 모드를 실행할 수 있습니다.
Chrome 는 절대 소프트웨어 컴포지팅과 하드웨어 레스트를 같이 사용하지 않지만, 다른 세 개의 레스터 모드 x 컴포지팅 모드의 조합은 유효 합니다.

컴포지팅 모드는 cc 가 제공하는 RasterBufferProvider 의 선택에 영향을 주는데, 레스터 워커 쓰레드에서 레스터 프로세스와 리소스 관리를 담당 합니다:

* BitmapRasterBufferProvider: 소프트웨어 컴포지팅을 위해 소프트웨어 비트맵을 레스터 합니다.

* OneCopyRasterBufferProvider: gpu 컴포지팅을 위해 공유 메모리에 소프트웨어 비트맵을 레스트 하며, gpu 프로세스에 업로드 됩니다.

* ZeroCopyRasterBufferProvider: gpu 컴포지팅을 위해 GpuMemoryBuffer 에 직접 소프트웨어 비트맵을 레스터 하고 (예, IOSurface), 디스플레이 컴포지터에 의해 바로 사용될 수 있습니다.

* GpuRasterBufferProvider: gpu 컴포지팅을 위해 gl (gpu 레스터) 혹은 paint (oop 레스터) 커맨드를 커맨드 버퍼에 보내서 gpu 텍스처를 레스터 합니다.

주의해야 할 점은 이미지 디코딩이 다른 쓰레드들에서 병렬로 수행 되더라도, context 에 대한 lock 때문에 gpu 와 oop 레스터는 특정 시간에 하나의 워커 쓰레드로 제한 된다는 것입니다.
이 단일 쓰레드 제약사항은 쓰레드 친밀도 보다는 lock 으로 해결 됩니다.

## Animation

이 디렉토리는 애니매이션 프레임웍을 구현 합니다. (cc::MutatorHost 인터페이스를 통해 LayerTreeHost(Impl) 에 의해서 사용 됩니다.) 프레임웍은 프로퍼티 트리에서 (ElementId 로 식별되는) 관련있는 TransformNode / EffectNode 에 대해서 값들을 직접 변경하기 위한 변환 목록, 불투명도, 필터 목록을 갖는 키 프레임 기반의 애니매이션을 지원 합니다.

하나의 애니메이션은 하나의 KeyframeEffects 를 갖는 (혹은 나중엔 여러개) Animation 인스턴스로 표현되는데,
각각은 여러개의 KeyframeModels 을 갖고 있습니다. Animation 은 재생 상태, 시작 시간과 같은 것들을 관리하고, KeyframeEffect 는 애니매이션의 대상 요소를 표현하며, 각 KeyframeModel 은 대상 요소에 대한 애니매이션의 특정 속성을 표한할 수 있습니다. (예, 변환 / 불투명도 / 필터) 애니매이션은 또한 embedder 애니매이션을 표현할 수도 있습니다. (예, 변환 속성에 대한 Blink 애니메이션)
혹은 cc 자체의 애니매이션일 수 있습니다. (예, 부드러운 스크롤을 위한 스크롤 애니매이션)

LayerTreeHostImpl 은 AnimationHost 에게 새로 생기거나 없어진 요소들을 알려주는데, 해당 요소들에 대한 애니매이션의 생태를 차례로 업데이트 할 것 입니다. 더 많은 애니매이션 프레임들이 스케쥴링 되어야 하는지 알기 위해 NeedsTickAnimations 를 호출하고, 매 프레임 마다 TickAnimations 를 호출해서 애니매이션 타이밍, 상태를 갱신하고, 애니매이션 이벤트들을 생성 합니다.
그리고 애니매이션에 근거하여 속성 트리 노드들의 실제 출력 값을 업데이트 합니다.

## cc/paint/

이 디렉토리는 페인트된 컨텐트를 표현하는 많은 클래스들이 있습니다.
이것들은 Skia 자료 구조들과 매우 비슷하지만 변경 가능하고(mutable), 내용을 볼 수 있으며(introspectable), 모든 경우에 직렬화(serializable) 할 수 있습니다.
이것들은 또한 Skia 가 신경쓰고 싶어하지 않는 보안 문제를 다룹니다. (예, [TOCTOU](https://en.wikipedia.org/wiki/Time_of_check_to_time_of_use) - 공유 메모리를 직렬화하여 gpu 프로세스가 읽을 때 악의적인 렌더러가 조작 할 수있는 문제들)

PaintRecord(PaintOpBuffer 로 알려진)는 많은 PaintOp 들을 저장하는 SkPicture 와 유사한 것 입니다.
PaintRecord 는 raster buffer provider 에 의해 비트맵이나 gpu 텍스쳐로 레스터라이즈 될 수 있고 (소프트웨어 혹은 gpu 레스터 사용시), 직렬화 될 수도 있습니다. (oop 레스터 사용시)

PaintCanvas 는 페인트 커맨드들을 기록하는 추상 클래스 입니다.
이것은 SkiaPaintCanvas (paint ops 에서 SkCanvas 로 이동) 혹은 PaintRecordCanvas (paint ops 를 recorded PaintRecord 로 변환) 로 구체화 됩니다.

## Scheduling

cc 의 동작들은 cc::Scheduler 에 의해 조율 됩니다.
이것은 크롬에 있는 많은 스케쥴러들 중에 하나이며, 여기에는 Blink 스케쥴러, viz::DisplayScheduler, 브라우저 UI 작업 스케쥴러, 그리고 gpu 스케쥴러가 있습니다.

cc::Scheduler 는 ProxyImpl (혹은 SingleThreadProxy)가 소유합니다.
그것은 다양한 입력을 받습니다.(가시성, begin frame 메세지들, redraw 요청들, 그릴 준비, 활성화 준비 등)
이 입력들은 cc::SchedulerStateMachine 을 동작하도록 하는데, SchedulerClient (혹은 LayerTreeHostImpl) 이 수행할 동작들을 결정하며, 여기에는 "Commit", “ActivateSyncTree”, “PrepareTiles” 와 같은 것들이 있습니다.
이 동작들은 일반적으로 파이프라인에서 비용이 큰 부분으로써, 조심스럽게 한게를 조절하길 원하기도 하고 상태와 관련된 종속성을 갖고 있기도 합니다.

cc::Scheduler 코드는 디스플레이 컴포지터로 오는 begin frame 들을 BeginImplFrame 로 구분하고 (예, cc가 컴포지터 프레임을 생성해야 함), 임베더를 위한 begin frame 은 BeginMainFrame 으로 구분 합니다. (예, cc는 Blink 에게 requestAnimationFrame 을 수행하고 커밋을 만들도록 하거나, 브라우저에서 cc 는 ui 에게 비슷한 것을 요구함.)
BeginImplFrame 은 viz::BeginFrameSource 의해 구동되고, 이것은 차례로 디스플레이 컴포지터에 의해 구동 됩니다.

낮은 지연과 빠른 레스터라이제이션으로 전체 파이프라인을 업데이트 하면, 일반적인 스케쥴링 흐름은 다음과 같습니다.
BeginImplFrame -> BeginMainFrame -> Commit -> ReadyToActivate -> Activate -> ReadyToDraw -> Draw.

추가적으로, 레스터라이제이션이 느리면, 두번째 BeginMainFrame 은 activation 전에 보내질 수 있고, SchedulingStateMachine 은 아직 activate 되지 않은 펜딩 트리가 있으면 커밋이 시작되는 것을 막기 때문에, activation 이 끝나기 전까지 NotifyReadyToCommit 에서 블럭될 것 입니다.
이것은 메인쓰레드가 지연되는 동안 가만히 있는 대신 병렬적으로 다음 프레임에 일을 할 수 있도록 합니다.
느린 레스터가 발생하는 하나의 가설적인 이벤트들의 순서 입니다:

BeginImplFrame1 -> BeginMainFrame1 -> Commit1 -> (slow raster) -> BeginImplFrame2 -> BeginMainFrame2 -> ReadyToActivate1 -> Activate1 -> Commit2 -> ReadyToDraw1 -> Draw1.

cc::Scheduler 는 임베더가 응답할 것으로 예상되는 마감시간 까지 유지 합니다.
메인 쓰레드가 응답이 느리면, Scheduler 는 커밋을 기다리지 않고 그릴 것 입니다.
이것이 발생한다면, Scheduler 는 고 지연 모드(high latency mode)로 전환하는 것을 고려 합니다.
나중에 프레임이 다시 빨라지면, 스케쥴러는 "따라잡고(catch up)" 저 지연 모드(low latency mode)로 재진입 하기 위해 BeginMainFrame 을 스킵하려고 할 수 있습니다.
고 지연 모드는 파이프라이닝을 늘림으로써, 처리량에 대한 대기시간을 없애 줍니다.
시간에 대한 기록을 유지하고 휴리스틱으로 보정하면서 이러한 구분을 유지 합니다. 

## Compositor frames, render passes, quads

cc 의 출력은 컴포지터 프레임(compositor frame) 입니다.
컴포지터 프레임은 메타 데이터(디바이스 배율, 컬러 스페이스, 크기) 와 랜더 패스들(render passes)의 순서있는 집합으로 구성되어 있습니다.
렌더 패스는 리소스들(예, gpu 텍스쳐)에 대한 참조와 이 리소스들을 어떻게 그릴지에 대한 정보(크기들, 배율들, 텍스쳐 좌표계들 등)를 갖고 있는 쿼드들(quads)의 순서있는 집합을 포함 합니다.
하나의 쿼드(quad)는 화면에 있는 하나의 사각형 이고, [컴포짓 레이어 테두리들이 보여질 때](https://developer.chrome.com/devtools/docs/rendering-settings#show-composited%20layer%20borders) 보여지는 것 입니다.
레이어들은 그들 자체로 파생된 AppendQuads 함수를 통해 쿼드들을 만들어 냅니다.
이것은 레이어의 보여지는 사각형(rect)를 (겹치거나 교차하지 않도록) 채우는 쿼드들의 집합을 만듭니다.

다른 레이어 타입들에 어느 정도 대응되는 다양한 종류의 쿼드들이 있습니다. (ContentDrawQuad, TextureDrawQuad, SolidColorDrawQuad)
많은 쿼드들을 만들어내는 레이어들(예, PictureLayerImpl)은 동일한 정보를 포함하는 많은 쿼드들을 만들기 때문에,
SharedQuadState 는 공유할 수 있는 정보를 모아서 개별적인 쿼드가 더 슬림 해지도록 하는 최적화 입니다.
RenderSurfaceImpl 들은 랜더 패스들과 1:1 로 대응되고, 레이어들이 쿼드들에게 하는 것과 동일한 AppendQuads 로직을 제공해서 RenderPassDrawQuads 를 만들기 위해 존재 합니다.

![compositor frame diagram](images/how_cc_works-compositor_frame.png)

랜더 패스들은 컴포짓 효과들(composited effects)를 제공하기 위해 존재 합니다. (참고: 효과 트리)
효과를 위해 컴포지팅이 필요한 경우들이 있습니다.
컴포지팅을 먼저 할 때, 그 효과를 쉽게 구현할 수 있는 경우들도 있습니다. (왜냐하면 그렇게 하면 레이어들의 서브 트리에서 생성되는 임의의 쿼드들에 대해 효과를 적용하는 대신, 하나의 렌더 패스 텍스쳐에 효과를 적용하기 때문 입니다.)
렌더 패스들의 흔한 경우들은: 마스크(masks), 필터(filter) (예, 블러(blur)), 회전한 레이어들 자르기(clipping), 혹은 컨텐트의 서브 트리에 적용된 불투명도(opacity).

컴포지터 프레임 안에서, 랜더 패스들과 하나의 랜더 패스에 있는 쿼드들은 정렬 됩니다.
랜더 패스들은 랜더 패스들의 종속성 트리를 나타내는 병합된 목록(flattened list) 입니다.
랜더 패스 1이 랜더 패스 9에 의존 한다면 (왜냐하면 랜더 패스 1이 갖고 있는 RenderPassDrawQuad 는 랜더 패스 9의 처리결과를 참조함), 9는 리스트에서 1보다 앞에 나타날 것 입니다.
따라서, 루트 랜더 패스는 항상 리스트의 마지막에 있습니다.
하나의 랜더 패스 안에는, 쿼드들은 뒤에서 앞으로 정렬 됩니다. ([Painter’s algorithm](https://en.wikipedia.org/wiki/Painter%27s_algorithm)).

일반적으로, 쿼드들은 3차원 공간에 있다고 고려되지 않으며 (3차원 변환으로 변형 되더라도) 순서대로 그려지며, 이전에 그려진 것 위에 그려집니다.
그러나, 쿼드들의 집합이 3차원 컨텍스트에 있을 수 있는 모드가 있습니다. (css transform-style: preserve-3d 를 사용하는 경우)
BSP 트리는 동일한 3차원 컨텍스트에서 서로를 정렬하고 교차시키는데 사용됩니다.

## Glossary

참고: [cc/README.md](https://chromium.googlesource.com/chromium/src/+/master/cc/README.md#glossaries)

## Other Resources

발표 자료들, 비디오들과 디자인 문서들의 목록, 참고: [https://www.chromium.org/developers/design-documents/chromium-graphics](https://www.chromium.org/developers/design-documents/chromium-graphics)

## Miscellaneous Corner Cases That Don’t Fit Anywhere Else, Sorry

### Damage

크롬은 시스템 전체적으로 무효화(invalidation)에 대한 다른 개념들이 있습니다.
"페인트 무효화(Paint invalidation)" 는 Blink 에서 다시 페인트 할 필요가 있는 문서의 부분들 입니다.
"레스터 무효화(Raster invalidation)" 는 변경되서 다시 레스터 될 필요가 있는 레이어의 부분들 입니다. (페인트 무효화 때문일 수도 있지만, 처음 레이어를 레스터하는 경우나, 텍스쳐가 버려지고 다시 필요하게 되는 경우일 수도 있습니다)
마지막으로, 손상(damage)은 "그리기 무효화(draw invalidation)" 의 다른 말 입니다.
그것은 다시 그려질 필요가 있는 화면의 부분 입니다.

두 종류의 손상(damage): 무효화 손상(invalidation damage)과 노출 손상(expose damage).
무효화 손상은 텍스쳐의 일부가 변경되었고 화면이 업데이트 될 필요가 있을 때 발생하는 레스터 무효화 때문입니다.
노출 손상은 레이어가 사라지거나, 처음 추가되거나, 재정렬될 때 발생 합니다.
이 경우 래스터 무효화가 없지만 화면을 계속 업데이트 해야합니다.

cc 는 DamageTracker 에서 손상을 계산하고, CompositorFrame 과 함께 그것을 전달 합니다.
디스플레이 컴포지터에서 손상이 필요한 한 가지 이유는 화면의 일부만 업데이트 하는 경우 부분적인 교체(partial swap)를 하기 위함이며, 이는 전력을 절약 합니다.
다른 이유는 하드웨어 오버레이(hardware overlays)를 사용할 때 인데, 디스플레이 컴포지터는 손상된 오버레이를 구분하고 씬(scene)의 나머지 오버레이들은 다시 컴포지팅(re-composite) 할 필요가 없다는 것을 알 수 있습니다.

### Mask Layers

마스크 레이어들은 [마스킹 효과](https://webkit.org/blog/181/css-masks/)를 구현하기 위해 사용됩니다.
이 레이어들은 부모 레이어가 없으며, 레이어 트리안에 있지 않습니다.
이 레이어들은 마스크가 적용될 레이어가 소유하고 있습니다.
마스크 레이어는 레이어 서브 클래스들 중에 어떤 것이든 될 수 있습니다. (예, PictureLayer 혹은 SolidColorLayer)
레이어들이 순회될 때 마다, 특별한 케이스로써 고려되어야 하는데 일반적인 부모/자식 트리의 일부가 아니기 때문 입니다.
AppendQuads 함수가 최상위 순회 대신 RenderSurfaceImpl 를 통과하지만, 레이어 자체가 그려지지 않고 효과의 일부이기 때문에,
레스터라이제이션과 타일 관리 측면에서는 다른 레이어들과 동일하게 취급 됩니다.

### "Impl"

cc 는 "impl" 이라는 접미사를 크롬의 나머지 부분들 혹은 다른 엔지니어들과 다르게 사용 합니다.
cc 에서 "impl" 은 메인 쓰레드가 아닌 컴포지터 쓰레드에서 사용되는 클래스를 의미 합니다.

이것에 대한 역사적인 이유는 메인 쓰레드에 있는 한 시점에서 메인 스레드에 레이어가 있었고, 컴포지터 스레드에서 실행하기 위해 동등한 클래스가 필요했기 때문입니다.
jamesr@ 는 nduca@ 과 상의 했는데, 그는 컴포지터 쓰레드에 있는 것들은 컴포지터 내부의 것들이며, 메인 쓰레드에 있는 것들에 대한 실제 구현체가 될 수 있기 때문에 LayerImpl 이라는 논리적인 주장을 했습니다.
참고: [https://bugs.webkit.org/show\_bug.cgi?id=55013#c5](https://bugs.webkit.org/show_bug.cgi?id=55013#c5)

이제 LayerImpls 의 트리가 필요하다면, LayerTreeImpl 가 있고, 이 트리들이 걸려있는 곳은 LayerTreeHostImpl 입니다.
갑자기, 모든 "impl 클래스들" 이 있는 것이 "impl 쓰레드" 가 되었습니다.
레스터라이제이션을 컴포지터 쓰레드로 옮긴다면, 갑자기 “impl 측 페인팅(impl-side painting)" 이라고 불리게 됩니다.
