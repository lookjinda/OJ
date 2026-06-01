import sqlite3
import json

class DifficultyAnalyzer:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        
    def analyze_programming_difficulty(self, content: str, test_cases: str) -> str:
        score = 0
        
        # 内容复杂度分析
        if len(content) > 500:
            score += 2
        elif len(content) > 200:
            score += 1
            
        # 关键词分析
        complex_keywords = ['递归', '动态规划', '回溯', '图论', '树结构', '排序算法', '搜索算法']
        for keyword in complex_keywords:
            if keyword in content:
                score += 2
                
        # 测试用例复杂度
        if test_cases:
            try:
                cases = json.loads(test_cases)
                if len(cases) > 5:
                    score += 1
            except:

                pass
                
        # 难度判定
        if score >= 4:
            return 'hard'
        elif score >= 2:
            return 'medium'
        else:
            return 'easy'
    
    def analyze_choice_difficulty(self, content: str, options: str) -> str:
        score = 0
        
        # 内容长度
        if len(content) > 300:
            score += 1
            
        # 选项复杂度
        if options:
            try:
                opts = json.loads(options)
                if len(opts) > 4:
                    score += 1
            except:
                pass
                
        # 知识点深度
        advanced_topics = ['算法', '数据结构', '复杂度', '递归', '面向对象']
        for topic in advanced_topics:
            if topic in content:
                score += 1
                
        # 难度判定
        if score >= 3:
            return 'hard'
        elif score >= 1:
            return 'medium'
        else:
            return 'easy'
    
    def analyze_all_questions(self):
        cursor = self.conn.cursor()
        cursor.execute("SELECT id, title, type, content, options, test_cases FROM questions")
        questions = cursor.fetchall()
        
        updates = []
        for qid, title, qtype, content, options, test_cases in questions:
            old_diff = cursor.execute("SELECT difficulty FROM questions WHERE id = ?", (qid,)).fetchone()[0]
            
            if qtype == 'programming':
                new_diff = self.analyze_programming_difficulty(content or '', test_cases or '')
            elif qtype == 'choice':
                new_diff = self.analyze_choice_difficulty(content or '', options or '')
            else:
                new_diff = 'easy'
                
            if new_diff != old_diff:
                updates.append((new_diff, qid))
                print(f"题目 {qid}: {title} | 原难度: {old_diff} -> 新难度: {new_diff}")
        
        return updates
    
    def update_difficulties(self, updates: list):
        cursor = self.conn.cursor()
        cursor.executemany("UPDATE questions SET difficulty = ? WHERE id = ?", updates)
        self.conn.commit()
        print(f"已更新 {len(updates)} 道题目的难度")
    
    def close(self):
        self.conn.close()

if __name__ == "__main__":
    analyzer = DifficultyAnalyzer('database.sqlite')
    updates = analyzer.analyze_all_questions()
    
    if updates:
        print(f"准备更新 {len(updates)} 道题目的难度...")
        analyzer.update_difficulties(updates)
    else:
        print("所有题目难度无需更新")
    
    analyzer.close()
