# Requests 实战要点

## 结论先行
- 掌握请求头伪装、Cookie 携带、超时与重试，就能应对 80% 的基础反爬场景。

## 背景
- 目标站点对频繁请求会返回 403，需要模拟浏览器行为。

## 要点
- 使用 `requests.Session()` 复用连接与 Cookie。
- `headers` 中带上 `User-Agent` 与 `Referer`。
- 配合 `time.sleep()` 或随机间隔控制频率。

## 参考
- requests 官方文档
