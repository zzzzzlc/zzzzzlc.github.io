---
title: React Native 入门到进阶：从环境搭建到生产级应用的完整路径
date: '2026-05-05'
tags:
  - 移动端
category: 移动端
summary: >-
  从 RN 学习曲线陡峭的实际痛点出发，系统梳理 React Native 从入门到进阶的完整知识体系——环境搭建与项目初始化（Expo vs
  Bare）、核心组件与样式系统、导航、状态管理、网络请求与缓存、性能优化（列表虚拟化/Reanimated/JSI/TurboModules）、原生模块桥接、打包发布，以及
  RN vs Flutter vs 原生的选型边界。
---

# React Native 入门到进阶：从环境搭建到生产级应用的完整路径

## 一、问题来源

React Native 是前端工程师进入移动端开发最自然的路径，但学习过程中充满挫折：

**入门阶段的痛点：**

- 环境搭建就卡住：Android SDK / NDK / JDK / Xcode / CocoaPods，配置一个能跑的环境就要一天
- 不清楚 Expo 和 Bare Workflow 的区别，选错了后续迁移成本极高
- RN 的样式不是 CSS，Flexbox 写法也有差异，DOM 操作全部不能用
- 调试困难：没有 Chrome DevTools 那样的体验，真机调试步骤繁琐

**进阶阶段的痛点：**

- 列表滚动卡顿，不知道用 FlatList 还是 SectionList，不知道怎么优化
- 动画不流畅，Animated API 写起来复杂，手势处理更复杂
- 需要调用原生能力（蓝牙、相机、推送），不知道怎么写 Bridge / Native Module
- 打包发布流程复杂，iOS 证书配置、Android 签名、热更新方案选择
- 不确定 RN 是否适合当前项目，和 Flutter / 原生开发怎么选

**核心问题：React Native 不是"用 React 写移动端"这么简单，它是一套完全不同的运行时环境、组件模型和调试体系。需要理解 RN 的架构才能写出生产级应用。**

---

## 二、环境搭建与项目初始化

### 2.1 Expo vs Bare Workflow

```
Expo（推荐新手）：
- 托管式开发环境，无需配置 Xcode / Android Studio
- 一条命令创建项目、预览、打包
- 内置大量常用 API（相机、地图、推送等）
- OTA 热更新
- 限制：不支持自定义原生模块（除非用 Expo Modules API 或 eject）

Bare Workflow（完全控制）：
- 等同于原生 RN 项目
- 可以自由添加原生代码和第三方 SDK
- 需要自己配置 Xcode / Android Studio
- 可以使用 react-native-link 链接原生依赖

┌──────────────┬──────────────────┬─────────────────────┐
│     维度     │     Expo         │   Bare Workflow     │
├──────────────┼──────────────────┼─────────────────────┤
│ 环境配置     │ 几乎零配置       │ Xcode + Android SDK │
│ 原生模块     │ Expo SDK 覆盖   │ 完全自由            │
│ 打包发布     │ EAS Build 云构建 │ 本地构建            │
│ 热更新       │ EAS Update       │ 自行搭建（CodePush）│
│ 学习曲线     │ 低               │ 高                  │
│ 适合场景     │ 大部分应用       │ 需要原生 SDK 集成   │
│ eject        │ 可随时 eject     │ —                   │
└──────────────┴──────────────────┴─────────────────────┘
```

### 2.2 项目初始化

```bash
# Expo 方式（推荐）
npx create-expo-app@latest MyApp --template blank-typescript
cd MyApp
npx expo start

# 在手机上预览：安装 Expo Go App → 扫描二维码

# Bare Workflow 方式
npx react-native@latest init MyApp --template react-native-template-typescript
cd MyApp

# iOS
npx pod-install ios
npx react-native run-ios

# Android
npx react-native run-android
```

### 2.3 开发工具链

```
推荐工具：

1. VS Code + 扩展
   - React Native Tools（调试）
   - Expo Tools（Expo 项目增强）

2. 调试
   - Expo Go：手机实时预览
   - Flipper：Meta 官方调试工具（网络、布局、数据库）
   - React DevTools：组件树检查
   - Chrome DevTools：console.log 输出

3. 真机调试
   - iOS：USB 连接 + Xcode
   - Android：USB 连接 + adb reverse tcp:8081 tcp:8081
   - 摇晃设备 → 打开开发菜单（Reload / Debug / Dev Settings）

4. 常用命令
   npx expo start --clear     # 清除缓存启动
   npx expo start --tunnel    # 通过隧道连接（不同网络时）
   npx expo start --web       # 同时启动 Web 版本
```

---

## 三、核心组件

### 3.1 RN 组件 vs HTML 元素

```
RN 没有浏览器 DOM，组件映射到原生视图：

HTML                    →  RN 组件
────────────────────────────────────────
<div>                   →  <View>
<span> / <p>            →  <Text>
<img>                   →  <Image>
<input>                 →  <TextInput>
<ul> / <ol>             →  <FlatList> / <SectionList>
<a>                     →  <Pressable> / <TouchableOpacity>
<scrollable div>        →  <ScrollView>
<input type="switch">   →  <Switch>
<video>                 →  <Video>（第三方）
<iframe>                →  <WebView>（第三方）

关键差异：
1. <Text> 是唯一的文本容器（不能在 <View> 中直接写文字）
2. 没有 CSS 文件，样式用 StyleSheet.create()
3. 所有组件默认 display: flex，flexDirection: column
4. 没有 CSS Grid
5. 没有 hover 状态（触摸设备）
```

### 3.2 基础组件示例

```typescript
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';

// SafeAreaView：适配刘海屏和底部安全区域
// StatusBar：控制状态栏样式
export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 文本 */}
        <Text style={styles.title}>Hello React Native</Text>
        <Text style={styles.subtitle}>
          当前平台：{Platform.OS}  {/* 'ios' | 'android' */}
        </Text>

        {/* 图片 */}
        <Image
          source={{ uri: 'https://example.com/photo.jpg' }}
          style={styles.image}
          resizeMode="cover"
        />
        {/* 本地图片 */}
        {/* <Image source={require('./assets/logo.png')} /> */}

        {/* 输入框 */}
        <TextInput
          style={styles.input}
          placeholder="请输入"
          placeholderTextColor="#999"
          keyboardType="email-address"    // 键盘类型
          autoCapitalize="none"
          returnKeyType="done"
          onChangeText={(text) => console.log(text)}
        />

        {/* 按钮 */}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,  // 按下状态
          ]}
          onPress={() => console.log('pressed')}
          android_ripple={{ color: '#00000020' }}  // Android 水波纹
        >
          <Text style={styles.buttonText}>提交</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

### 3.3 样式系统要点

```typescript
// RN 样式是 CSS 的子集，有重要差异：

// 1. 默认 Flexbox，flexDirection: column（Web 默认 row）
//    要水平排列需要 flexDirection: 'row'
<View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
  <Text>左</Text>
  <Text>右</Text>
</View>

// 2. 没有 % 以外的相对单位（没有 rem / em / vw）
//    只能用数字（dp）或百分比
<View style={{ width: '50%', height: 100 }} />

// 3. 没有 CSS 简写属性
//    ❌ margin: 10
//    ✅ marginTop: 10, marginBottom: 10, ...
//    ❌ padding: 10 20
//    ✅ paddingTop: 10, paddingHorizontal: 20

// 4. 没有 overflow: hidden 以外的大部分 overflow 行为
// 5. 没有 CSS 动画和 transition（用 Animated / Reanimated）
// 6. 没有 z-index 的层叠上下文（z-index 有但行为不同）
// 7. Shadow 属性不同
//    iOS: shadowColor / shadowOffset / shadowOpacity / shadowRadius
//    Android: elevation
const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  android: {
    elevation: 4,
  },
});

// 8. 平台特定样式
const styles = StyleSheet.create({
  container: {
    padding: 16,
    ...Platform.select({
      ios: { paddingTop: 48 },      // iOS 状态栏
      android: { paddingTop: 24 },
    }),
  },
});
```

---

## 四、导航

### 4.1 React Navigation（标准方案）

```typescript
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Stack 导航（页面跳转）
const Stack = createNativeStackNavigator();

// Tab 导航（底部标签页）
const Tab = createBottomTabNavigator();

// 底部 Tab
function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          // 返回图标组件
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '首页' }} />
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ title: '发现' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: '我的' }} />
    </Tab.Navigator>
  );
}

// 根 Stack
function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Main"
          component={HomeTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Detail"
          component={DetailScreen}
          options={{ title: '详情', presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

### 4.2 页面传参

```typescript
// 跳转并传参
navigation.navigate('Detail', {
  id: '123',
  title: '文章标题',
});

// 目标页面接收参数
function DetailScreen({ route, navigation }) {
  const { id, title } = route.params;

  // 设置导航栏标题
  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  return <Text>文章 ID: {id}</Text>;
}

// TypeScript 类型安全
type RootStackParamList = {
  Main: undefined;
  Detail: { id: string; title: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// 类型安全的导航
type DetailScreenProps = NativeStackScreenProps<RootStackParamList, 'Detail'>;
function DetailScreen({ route, navigation }: DetailScreenProps) {
  const { id } = route.params;  // 类型自动推导
}
```

### 4.3 导航方案对比

| 方案 | 特点 | 适用场景 |
|------|------|---------|
| Stack Navigator | 页面栈，先进后出 | 大部分页面跳转 |
| Tab Navigator | 底部/顶部标签 | 主页分 Tab |
| Drawer Navigator | 侧滑抽屉 | 管理后台、设置页 |
| Modal | 弹出式页面 | 表单、选择器 |
| Nested | 导航嵌套 | Tab 内嵌 Stack |

---

## 五、状态管理

### 5.1 RN 中的状态管理选择

```
和 Web React 相同的状态方案都可以用：

1. useState / useReducer → 组件内状态
2. Context + useContext   → 跨组件共享（轻量）
3. Zustand               → 简洁的全局状态（推荐）
4. Redux Toolkit         → 大型项目
5. Jotai / Recoil        → 原子化状态
6. React Query / SWR     → 服务端状态（网络请求缓存）

选型和 Web React 一致，不再赘述
```

### 5.2 异步存储

```typescript
// AsyncStorage：RN 的本地持久化存储（类似 localStorage）
import AsyncStorage from '@react-native-async-storage/async-storage';

// 存储
await AsyncStorage.setItem('userToken', token);
await AsyncStorage.multiSet([['key1', 'value1'], ['key2', 'value2']]);

// 读取
const token = await AsyncStorage.getItem('userToken');
const values = await AsyncStorage.multiGet(['key1', 'key2']);

// 删除
await AsyncStorage.removeItem('userToken');
await AsyncStorage.clear();  // 清空所有

// 注意：
// - AsyncStorage 是异步的（不像 localStorage 是同步的）
// - 只能存字符串（对象需要 JSON.stringify/parse）
// - 不加密，不要存敏感信息
// - 容量有限（Android 默认 6MB）

// 敏感数据用 SecureStore（Expo）或 Keychain / Keystore
import * as SecureStore from 'expo-secure-store';
await SecureStore.setItemAsync('password', 'secret');
const pwd = await SecureStore.getItemAsync('password');
```

### 5.3 MMKV（高性能存储）

```typescript
// MMKV：微信开源的高性能 KV 存储
// 比 AsyncStorage 快 30 倍+，同步 API

import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

// 同步读写
storage.set('userToken', 'abc123');
storage.set('user', JSON.stringify({ name: '张三', age: 25 }));

const token = storage.getString('userToken');
const user = JSON.parse(storage.getString('user') ?? '{}');

// 支持 TypedArray / Boolean
storage.set('isFirstLaunch', true);
storage.getBoolean('isFirstLaunch');

// 删除
storage.delete('userToken');

// 加密存储
const encryptedStorage = new MMKV({
  id: 'encrypted',
  encryptionKey: 'your-secret-key',
});
```

---

## 六、网络请求

### 6.1 fetch 与 axios

```typescript
// RN 中可以直接使用 fetch（全局可用）
// 也可以用 axios

// 示例：封装 API 请求
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://api.example.com';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await AsyncStorage.getItem('userToken');

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// 使用
const users = await request<User[]>('/users');
const order = await request<Order>('/orders/123', {
  method: 'POST',
  body: JSON.stringify({ items: [...] }),
});
```

### 6.2 React Query（推荐）

```typescript
// RN 中使用 React Query 和 Web 完全一致
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 分钟内不重新请求
      retry: 2,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HomeScreen />
    </QueryClientProvider>
  );
}

function HomeScreen() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['articles'],
    queryFn: () => request<Article[]>('/articles'),
  });

  // 下拉刷新
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      refreshing={isLoading}
      onRefresh={refetch}
      renderItem={({ item }) => <ArticleCard article={item} />}
    />
  );
}
```

---

## 七、列表与性能优化

### 7.1 ScrollView vs FlatList

```typescript
// ScrollView：简单滚动，一次性渲染所有子元素
// 适合：内容不多（< 50 项）、表单、文章页面
<ScrollView>
  <Text>内容1</Text>
  <Text>内容2</Text>
  {/* 100 个元素也会全部渲染 */}
</ScrollView>

// FlatList：虚拟化列表，只渲染可见项
// 适合：大量数据（> 50 项）、商品列表、消息列表
<FlatList
  data={articles}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ArticleCard article={item} />}

  // 下拉刷新
  refreshing={isRefreshing}
  onRefresh={handleRefresh}

  // 上拉加载更多
  onEndReached={handleLoadMore}
  onEndReachedThreshold={0.5}

  // 性能优化
  initialNumToRender={10}        // 首次渲染数量
  maxToRenderPerBatch={5}        // 每批渲染数量
  windowSize={5}                 // 渲染窗口大小（屏数）
  removeClippedSubviews={true}   // 移除不可见视图（Android）
  getItemLayout={(data, index) =>( // 固定高度时提供，大幅提升性能
    { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
  )}

  // 空状态
  ListEmptyComponent={<EmptyState />}

  // 分隔线
  ItemSeparatorComponent={() => <View style={{ height: 8 }} />}

  // 头尾
  ListHeaderComponent={<SearchBar />}
  ListFooterComponent={isLoadingMore ? <LoadingSpinner /> : null}
/>

// SectionList：分组列表
<SectionList
  sections={[
    { title: 'A', data: ['Alice', 'Amy'] },
    { title: 'B', data: ['Bob', 'Bill'] },
  ]}
  keyExtractor={(item, index) => item + index}
  renderItem={({ item }) => <Text>{item}</Text>}
  renderSectionHeader={({ section }) => (
    <Text style={styles.sectionHeader}>{section.title}</Text>
  )}
/>
```

### 7.2 性能优化清单

```typescript
// 1. React.memo 防止不必要的重渲染
const ArticleCard = React.memo(({ article }: { article: Article }) => {
  return (
    <View style={styles.card}>
      <Text>{article.title}</Text>
    </View>
  );
});

// 2. useCallback / useMemo
const renderItem = useCallback(
  ({ item }: { item: Article }) => <ArticleCard article={item} />,
  [],
);

const keyExtractor = useCallback((item: Article) => item.id, []);

<FlatList
  data={articles}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
/>

// 3. 提供 getItemLayout（固定高度列表必备）
const ITEM_HEIGHT = 80;
<FlatList
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>

// 4. 避免内联函数和对象
// ❌ 每次 render 都创建新的 style 对象和函数
<Pressable onPress={() => doSomething()} style={{ padding: 16 }}>

// ✅ 提取到外部
const handlePress = useCallback(() => doSomething(), []);
const styles = StyleSheet.create({ item: { padding: 16 } });
<Pressable onPress={handlePress} style={styles.item} />

// 5. 图片优化
<Image
  source={{ uri: url, cache: 'force-cache' }}  // 启用缓存
  resizeMode="contain"
  fadeDuration={300}                            // 淡入动画
  defaultSource={require('./placeholder.png')}  // 占位图
/>

// 6. 使用 FlashList（Shopify 开源，比 FlatList 快 5 倍）
import { FlashList } from '@shopify/flash-list';
<FlashList
  data={articles}
  renderItem={renderItem}
  estimatedItemSize={80}  // 必须提供预估高度
/>
```

---

## 八、动画与手势

### 8.1 Reanimated（推荐动画库）

```typescript
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';

function AnimatedCard() {
  // 共享值（在 UI 线程运行，不经过桥）
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  // 动画样式
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePress = () => {
    // 弹簧动画
    translateY.value = withSpring(-20, { damping: 10 });

    // 时间动画
    opacity.value = withTiming(0.5, { duration: 300 });

    // 序列动画
    scale.value = withSequence(
      withTiming(1.2, { duration: 150 }),
      withTiming(1, { duration: 150 }),
    );
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <Text>点击触发动画</Text>
      </Animated.View>
    </Pressable>
  );
}
```

### 8.2 Gesture Handler（手势处理）

```typescript
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

function SwipeableCard() {
  const translateX = useSharedValue(0);

  // 平移手势
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd(() => {
      // 如果滑动超过 100，则滑出屏幕
      if (Math.abs(translateX.value) > 100) {
        translateX.value = withTiming(translateX.value > 0 ? 300 : -300);
      } else {
        translateX.value = withSpring(0);
      }
    });

  // 点击手势
  const tap = Gesture.Tap().onEnd(() => {
    console.log('tapped');
  });

  // 组合手势：点击 + 平移互斥
  const composed = Gesture.Race(pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureHandlerRootView>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.card, animatedStyle]}>
          <Text>左右滑动或点击</Text>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
```

### 8.3 Animated vs Reanimated 对比

| 维度 | RN Animated | Reanimated |
|------|------------|------------|
| 运行线程 | JS 线程 | UI 线程 |
| 掉帧 | JS 繁忙时会掉帧 | 不受 JS 影响 |
| 手势配合 | 需要 Animated.event | 原生支持 |
| API 复杂度 | 较复杂 | 更直观 |
| 调试 | 困难 | 较容易 |
| 推荐 | 简单动画 | 所有场景（推荐） |

---

## 九、架构原理

### 9.1 RN 新架构（Fabric + TurboModules）

```
RN 渲染流程：

旧架构（Bridge）：
┌──────────┐    JSON 序列化    ┌──────────┐
│   JS 层   │ ──────────────→ │  原生层    │
│ (React)  │ ←────────────── │ (Native) │
└──────────┘    JSON 反序列化  └──────────┘
              ↑ 异步桥接，性能瓶颈

新架构（Fabric + TurboModules）：
┌──────────┐   JSI（C++ 直接调用）  ┌──────────┐
│   JS 层   │ ←──────────────────→ │  原生层    │
│ (React)  │    同步/异步均可       │ (Native) │
└──────────┘                       └──────────┘

JSI（JavaScript Interface）：
- JS 可以直接持有 C++ 对象的引用
- 不需要 JSON 序列化/反序列化
- 可以同步调用原生方法

Fabric：
- 新的渲染系统
- JS 和原生渲染同步更新
- 支持并发特性（React 18+）
- 渲染优先级（紧急交互优先于数据加载）

TurboModules：
- 新的原生模块系统
- 按需加载（不再启动时加载所有模块）
- 类型安全（Codegen 生成类型）
- 更快的启动速度
```

### 9.2 渲染流程

```
React 组件树
    │ React Reconciler
    ▼
Shadow Tree（C++ 层的虚拟 DOM）
    │ Fabric
    ▼
原生视图树（iOS: UIView / Android: View）
    │
    ▼
屏幕渲染

关键差异（vs 浏览器）：
- 浏览器：React → DOM → CSSOM → Render Tree → Layout → Paint
- RN：    React → Shadow Tree → Native View → 系统渲染
- RN 没有 CSSOM、Layout、Paint 概念（交给原生系统处理）
```

---

## 十、原生模块

### 10.1 什么时候需要原生模块

```
需要原生模块的场景：
1. Expo SDK 没有覆盖的 API（蓝牙、NFC、特定传感器）
2. 需要集成第三方原生 SDK（支付、地图、IM）
3. 性能关键的计算（图像处理、加密）
4. 平台特有的 UI 组件

不需要原生模块的场景：
- 网络请求、存储、导航、动画 → JS 层就能搞定
- 相机、推送、定位 → Expo SDK 已覆盖
```

### 10.2 原生模块示例

```typescript
// ──── JS 层（TypeScript）────

// 方法 1：Turbo Modules（新架构）
// MathLib.ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  add(a: number, b: number): Promise<number>;
  multiply(a: number, b: number): number;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MathLib');
```

```swift
// ──── iOS 原生层（Swift）────
// MathLib.swift

@objc(MathLib)
class MathLib: NSObject {
  @objc(add:resolve:reject:)
  func add(_ a: NSNumber, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    resolve(a.intValue + b.intValue)
  }

  @objc(multiply:)
  func multiply(_ a: NSNumber) -> NSNumber {
    return NSNumber(value: a.intValue * b.intValue)
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
```

```kotlin
// ──── Android 原生层（Kotlin）────
// MathLibModule.kt

class MathLibModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "MathLib"

  @ReactMethod
  fun add(a: Int, b: Int, promise: Promise) {
    promise.resolve(a + b)
  }

  @ReactMethod
  fun multiply(a: Int, b: Int): Int {
    return a * b
  }
}
```

### 10.3 Expo Modules API（推荐 Expo 项目）

```typescript
// Expo 的原生模块 API 更简洁
// expo-module.config.json
{
  "platforms": ["ios", "android"],
  "ios": { "modules": ["MyModule"] },
  "android": { "modules": ["MyModule"] }
}

// MyModule.ts (JS 接口)
import { requireNativeModule } from 'expo-modules-core';
export default requireNativeModule('MyModule');

// MyModule.swift (iOS)
import ExpoModulesCore

public class MyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MyModule")

    AsyncFunction("add") { (a: Int, b: Int) in
      return a + b
    }

    Function("multiply") { (a: Int, b: Int) in
      return a * b
    }
  }
}

// MyModule.kt (Android)
class MyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MyModule")

    AsyncFunction("add") { a: Int, b: Int ->
      a + b
    }

    Function("multiply") { a: Int, b: Int ->
      a * b
    }
  }
}
```

---

## 十一、打包与发布

### 11.1 Expo 构建流程

```bash
# 配置 EAS Build
eas build:configure

# 构建 iOS
eas build --platform ios

# 构建 Android
eas build --platform android

# 构建所有平台
eas build --platform all

# 提交到应用商店
eas submit --platform ios    # 提交到 App Store Connect
eas submit --platform android # 提交到 Google Play Console

# OTA 热更新
eas update --branch production --message "修复 bug"
```

### 11.2 版本更新策略

```
三种更新方式：

1. OTA 热更新（EAS Update / CodePush）
   - 只更新 JS Bundle，不需要重新安装
   - 适合 bug 修复、UI 调整
   - 不能修改原生代码
   - 用户下次打开 App 自动生效

2. 应用商店更新
   - 完整包更新
   - 适合原生代码变更、新增原生模块
   - 需要审核（iOS 1~3 天，Android 几小时）

3. 强制更新
   - 服务端返回最低版本号
   - 客户端比较版本 → 弹窗引导更新
```

```typescript
// 强制更新检查
import { getVersion } from 'react-native-device-info';
import { compare } from 'compare-versions';

async function checkUpdate() {
  const { minVersion, latestVersion, updateUrl } = await request('/app/config');
  const currentVersion = getVersion();

  if (compare(currentVersion, minVersion, '<')) {
    // 强制更新
    Alert.alert('需要更新', '当前版本过低，请更新到最新版本', [
      { text: '去更新', onPress: () => Linking.openURL(updateUrl) },
    ]);
  } else if (compare(currentVersion, latestVersion, '<')) {
    // 可选更新
    Alert.alert('发现新版本', '是否更新？', [
      { text: '以后再说', style: 'cancel' },
      { text: '更新', onPress: () => Linking.openURL(updateUrl) },
    ]);
  }
}
```

---

## 十二、RN vs Flutter vs 原生

### 12.1 三种方案对比

| 维度 | React Native | Flutter | 原生（Swift / Kotlin） |
|------|-------------|---------|----------------------|
| 语言 | JavaScript/TS | Dart | Swift / Kotlin |
| 渲染 | 原生组件 | 自绘引擎（Skia） | 系统原生 |
| 性能 | 中高 | 高 | 最高 |
| 热更新 | 支持（OTA） | 不支持 | 不支持 |
| 生态 | npm + RN 生态 | pub.dev | iOS/Android 各自生态 |
| 学习曲线 | 低（会 React 即可） | 中（需学 Dart） | 高（需学两套） |
| 跨平台 | iOS + Android + Web | iOS + Android + Web + Desktop | 各自独立 |
| 原生能力 | Bridge/JSI | Platform Channel | 直接调用 |
| 团队 | 前端团队 | 需要学 Dart | iOS + Android 两个团队 |
| 适用 | 中等复杂度 App | 高性能/自定义 UI | 性能极致/平台特有 |

### 12.2 选型建议

```
选 React Native 当：
✅ 团队有 React/JS 经验
✅ 需要热更新
✅ App 复杂度中等（内容展示、表单、电商）
✅ 需要复用 Web 端的状态管理/工具链
✅ 已有 React Web 项目，想共享业务逻辑

选 Flutter 当：
✅ 需要高度自定义的 UI
✅ 动画/游戏类 App
✅ 愿意投入学习 Dart
✅ 需要一致的跨平台 UI 表现
✅ 不需要热更新

选原生当：
✅ 性能要求极致（AR、图像处理、大量动画）
✅ 只需要支持一个平台
✅ 需要深度使用平台特有 API
✅ 团队有充足的原生开发经验
✅ 不需要跨平台
```

### 12.3 局限性

```
React Native 的局限：

1. 性能天花板
   - JS 和原生之间仍有通信开销（即使 JSI 改善了很多）
   - 复杂动画、大量列表滚动不如 Flutter / 原生流畅
   - JS 线程繁忙时 UI 会卡顿

2. 原生模块维护成本
   - 第三方库可能只维护 iOS 不维护 Android
   - 版本升级可能导致原生模块不兼容
   - 需要写原生代码时需要两套（iOS + Android）

3. 调试体验不如 Web
   - 虽然有 Flipper / React DevTools，但整体不如浏览器 DevTools 好用
   - 样式调试不够直观
   - 真机调试配置繁琐

4. 包体积
   - 必须携带 JS 引擎（Hermes ~3MB）
   - 比 Flutter / 原生应用基础包体积大

5. 版本升级
   - RN 大版本升级可能引入 breaking changes
   - 原生依赖需要同步更新
   - 升级成本高于 Web 项目
```

---

## 十三、学习路径

```
RN 能力层级：

Level 1（入门）- 能写基本页面
  □ 环境搭建 + Expo 项目创建
  □ 核心组件（View / Text / Image / Pressable / ScrollView）
  □ StyleSheet 样式系统
  □ FlatList 列表渲染
  □ React Navigation 页面导航

Level 2（熟练）- 能写完整 App
  □ 状态管理（Zustand / React Query）
  □ AsyncStorage / MMKV 持久化
  □ 网络请求封装
  □ 表单处理（react-hook-form）
  □ 下拉刷新 + 上拉加载
  □ 平台适配（Platform.select / Platform.OS）
  □ TypeScript 集成

Level 3（进阶）- 能优化性能
  □ Reanimated 动画
  □ Gesture Handler 手势
  □ FlatList / FlashList 性能优化
  □ React.memo / useCallback 优化
  □ 图片缓存和懒加载
  □ Hermes 引擎优化
  □ Bundle 分析和拆分

Level 4（精通）- 能扩展原生能力
  □ 原生模块开发（Bridge / JSI）
  □ Expo Modules API
  □ TurboModules + Codegen
  □ 自定义原生 UI 组件
  □ 打包发布 + OTA 热更新
  □ 新架构（Fabric）理解和迁移
```
