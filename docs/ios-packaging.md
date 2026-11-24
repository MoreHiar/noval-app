# iPhone 未签名 IPA

没有付费 Apple Developer Program 账号时，可以通过 EAS 的 macOS 构建机编译真机应用，并生成供个人重新签名的 IPA。项目的 `unsigned-ios` 配置使用 `ios.withoutCredentials` 和自定义构建流程，不上传 Apple 证书，不生成可直接安装的签名包。

```bash
npx eas-cli@latest whoami
npx eas-cli@latest build --platform ios --profile unsigned-ios --non-interactive
```

构建流程位于 `.eas/build/unsigned-ios.yml`：安装依赖、通过 Expo prebuild 生成原生工程、安装 CocoaPods、运行 `scripts/build-unsigned-ios.sh` 编译 Release 真机应用，并上传 `Noval-unsigned.ipa`。原生工程只在云端生成，不纳入 Git。

脚本检查应用包含 arm64 可执行文件和内置 JavaScript bundle。打包成功后可脱离开发服务器运行；在线搜索与阅读仍需访问书源网站。Windows 无法在本机运行 Xcode 编译脚本，应通过上述 EAS 命令提交到云端。

## 安装限制

- 未签名的 `.ipa` 不能直接在普通 iPhone 上安装，也不能上传到 TestFlight 或 App Store。
- 可以使用 AltStore、Sideloadly 等侧载工具，在自己的电脑上用普通 Apple ID 重新签名。不要把 Apple ID 密码、验证码或证书提交到仓库。
- 免费个人签名通常有效 7 天，需要续签；设备和应用数量等限制以 Apple 及侧载工具当前规则为准。
- iOS 模拟器构建与此不同，模拟器产物不能改后缀当成 iPhone 安装包。

官方参考：[EAS 配置中的 withoutCredentials](https://docs.expo.dev/eas/json/#withoutcredentials)、[自定义构建](https://docs.expo.dev/custom-builds/get-started/)。

## 已生成的构建

2026-11-24 的 [首次未签名构建](https://expo.dev/accounts/kanshan/projects/noval-app/builds/b0122ca5-1c5c-4079-91ef-a1643ebf2050) 已成功。下载后的 `Noval-1.0.0-unsigned.ipa` 为 12,238,807 字节，包标识 `com.kanshan.novalapp`，版本 `1.0.0`，最低 iOS `16.4`。ZIP 完整性、arm64 真机可执行文件和内置 JavaScript bundle 检查通过；包内没有 provisioning profile，尚未完成重新签名后的 iPhone 安装测试。
