#!/bin/bash

# 设置下载文件的 URL 和目标目录
FILE_URL="https://registry.npmjs.org/scanbot-web-sdk/-/scanbot-web-sdk-5.1.0.tgz"
TEMP_DIR="./tmp"
PUBLIC_DIR="./public"  # 目标 public 目录的路径

# 创建临时目录以存放下载的文件
mkdir -p $TEMP_DIR

# 下载 .tgz 文件
echo "Downloading scanbot-web-sdk package..."
wget $FILE_URL -O $TEMP_DIR/scanbot-web-sdk-5.1.0.tgz

# 解压 .tgz 文件
echo "Extracting scanbot-web-sdk-5.1.0.tgz..."
tar -xvzf $TEMP_DIR/scanbot-web-sdk-5.1.0.tgz

# 将解压后的 package 文件夹重命名为 scanbot-web-sdk
mv package $PUBLIC_DIR/scanbot-web-sdk


# # 清理临时文件
rm -rf $TEMP_DIR

echo "Deployment complete. scanbot-web-sdk has been moved to the public directory."
