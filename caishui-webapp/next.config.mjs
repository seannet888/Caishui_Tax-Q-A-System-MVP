/** @type {import("next").NextConfig} */
const nextConfig = {
  // Docker 部署使用 standalone 输出，缩小镜像体积
  // Windows 未启用符号链接权限时，可用 NEXT_DISABLE_STANDALONE=true 完成本地构建校验。
  output:
    process.env.NEXT_DISABLE_STANDALONE === "true" ? undefined : "standalone",
  experimental: {
    // Server Components 中使用 Prisma 时，避免被错误打包
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
    // 启用 instrumentation.ts 的 register() 启动钩子（Serverless 部署守卫，见 ADR-0008）
    instrumentationHook: true,
  },
};

export default nextConfig;
