package com.makemdown.app

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

/**
 * 数据备份工具 —— 解决 MIUI/HyperOS 激进杀进程导致 localStorage 数据丢失
 *
 * 原理：
 * 1. JS 端每次保存 localStorage 时同步把 content 写到 app 内部文件
 * 2. 启动时如果 localStorage 为空但备份文件存在，自动恢复
 * 3. 用 fsync 强制落盘（FileDescriptor.sync）
 */
object DataBackup {

    private const val TAG = "DataBackup"
    private const val BACKUP_FILE = "content_backup.md"
    private const val MAX_BACKUP_SIZE = 5 * 1024 * 1024  // 5MB 上限

    /**
     * 把 Markdown 内容写入备份文件
     */
    fun save(context: Context, content: String) {
        try {
            if (content.length > MAX_BACKUP_SIZE) {
                Log.w(TAG, "内容超过 5MB，跳过备份")
                return
            }
            val file = File(context.filesDir, BACKUP_FILE)
            file.parentFile?.mkdirs()

            val fos = FileOutputStream(file)
            fos.use { out ->
                out.write(content.toByteArray(Charsets.UTF_8))
                out.flush()
                try { out.fd.sync() } catch (e: Throwable) {
                    Log.w(TAG, "fsync 失败（不影响数据）", e)
                }
            }
        } catch (e: Throwable) {
            Log.e(TAG, "备份失败", e)
        }
    }

    /**
     * 读取备份内容（启动时调用）
     */
    fun load(context: Context): String? {
        return try {
            val file = File(context.filesDir, BACKUP_FILE)
            if (!file.exists()) return null
            FileInputStream(file).use { it.readBytes().toString(Charsets.UTF_8) }
        } catch (e: Throwable) {
            Log.e(TAG, "读取备份失败", e)
            null
        }
    }

    /**
     * 清除备份
     */
    fun clear(context: Context) {
        try { File(context.filesDir, BACKUP_FILE).delete() } catch (_: Throwable) {}
    }

    fun size(context: Context): Long {
        val file = File(context.filesDir, BACKUP_FILE)
        return if (file.exists()) file.length() else 0L
    }
}