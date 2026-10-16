#!/usr/bin/env python3
"""给 consult_sessions 添加定时会诊所需的 scheduled_at 字段（只做 DDL，不动任何数据）。

背景：云端库 critical 的 consult_sessions 缺少 scheduled_at 列，而后端代码（模型/校验/服务）
已按该列适配，导致 POST /consultations 建单时 SQLSTATE[42S22] Unknown column 'scheduled_at' → 500。

配置从 backend/.env 读取，不会把账号密码写进脚本。

用法：
    python add_scheduled_at.py                # 添加字段（幂等，已存在则跳过）
    python add_scheduled_at.py --check        # 只检查当前状态，不做改动
    python add_scheduled_at.py --rollback     # 回滚：删除本脚本添加的字段

说明：
    * 仅执行 ALTER TABLE ... ADD COLUMN，不执行任何 INSERT/UPDATE/DELETE；
    * DDL 前先查 information_schema，已存在则跳过，可重复执行；
    * 字段可空（NULL 表示立即开始），存量会诊单行为不变。
"""
import os
import sys

import pymysql
from pymysql.err import ProgrammingError

ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env")
TABLE = "consult_sessions"

# (列名, 完整列定义, 放在哪个列之后)
COLUMNS = [
    (
        "scheduled_at",
        "DATETIME NULL DEFAULT NULL COMMENT '预定开始时间：为空表示立即开始'",
        "note",
    ),
]


def load_env(path):
    env = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            env[key.strip()] = val.strip().strip("\"'")
    return env


def connect(env):
    return pymysql.connect(
        host=env["DB_HOST"],
        port=int(env.get("DB_PORT", 3306)),
        user=env["DB_USERNAME"],
        password=env.get("DB_PASSWORD", ""),
        database=env["DB_DATABASE"],
        charset="utf8mb4",
        autocommit=True,
        connect_timeout=10,
    )


def existing_columns(cur, db):
    cur.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA=%s AND TABLE_NAME=%s",
        (db, TABLE),
    )
    return {r[0] for r in cur.fetchall()}


def do_apply(env):
    db = env["DB_DATABASE"]
    with connect(env) as conn:
        with conn.cursor() as cur:
            cols = existing_columns(cur, db)
            changed = 0

            for name, define, after in COLUMNS:
                if name in cols:
                    print(f"  · 跳过 {name}（已存在）")
                    continue
                cur.execute(
                    f"ALTER TABLE `{TABLE}` ADD COLUMN `{name}` {define} AFTER `{after}`"
                )
                print(f"  ✅ 已添加列 {name}")
                changed += 1

            cur.execute(f"SELECT COUNT(*) FROM `{TABLE}`")
            rows = cur.fetchone()[0]

    print(f"\n完成：本次改动 {changed} 项。表 {TABLE} 现有 {rows} 行数据（未修改）。")
    return changed


def do_check(env):
    db = env["DB_DATABASE"]
    with connect(env) as conn:
        with conn.cursor() as cur:
            cols = existing_columns(cur, db)
            cur.execute(f"SELECT COUNT(*) FROM `{TABLE}`")
            rows = cur.fetchone()[0]
    print(f"库: {db}  表: {TABLE}  数据行数: {rows}\n")
    print("scheduled_at 字段：")
    for name, _, _ in COLUMNS:
        print(f"  {'✅' if name in cols else '❌'} {name}")
    return 0


def do_rollback(env):
    db = env["DB_DATABASE"]
    with connect(env) as conn:
        with conn.cursor() as cur:
            cols = existing_columns(cur, db)
            for name, _, _ in COLUMNS:
                if name in cols:
                    cur.execute(f"ALTER TABLE `{TABLE}` DROP COLUMN `{name}`")
                    print(f"  ↩️ 已删除列 {name}")
    print("\n回滚完成（仅删除本脚本添加的字段，数据未受影响）。")
    return 0


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "--apply"
    env = load_env(ENV_PATH)
    print(f"目标库: {env['DB_HOST']}:{env.get('DB_PORT', 3306)}/{env['DB_DATABASE']}\n")
    try:
        if mode == "--check":
            do_check(env)
        elif mode == "--rollback":
            do_rollback(env)
        else:
            do_apply(env)
    except ProgrammingError as e:
        print(f"执行失败: {e}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
