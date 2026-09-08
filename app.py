from flask import Flask, request, jsonify
import os
import shutil

app = Flask(__name__)

@app.route('/')
def index():
    return 'DeepSeek Coding Agent Web UI'

@app.route('/api/list', methods=['GET'])
def list_files():
    path = request.args.get('path', '.')
    try:
        items = os.listdir(path)
        return jsonify({'success': True, 'items': items})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/read', methods=['GET'])
def read_file():
    path = request.args.get('path')
    if not path:
        return jsonify({'success': False, 'error': 'Path required'}), 400
    try:
        with open(path, 'r') as f:
            content = f.read()
        return jsonify({'success': True, 'content': content})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/write', methods=['POST'])
def write_file():
    data = request.get_json()
    path = data.get('path')
    content = data.get('content', '')
    if not path:
        return jsonify({'success': False, 'error': 'Path required'}), 400
    try:
        with open(path, 'w') as f:
            f.write(content)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/edit', methods=['POST'])
def edit_file():
    data = request.get_json()
    path = data.get('path')
    old_text = data.get('old_text')
    new_text = data.get('new_text')
    if not path or old_text is None or new_text is None:
        return jsonify({'success': False, 'error': 'Path, old_text, new_text required'}), 400
    try:
        with open(path, 'r') as f:
            content = f.read()
        if old_text not in content:
            return jsonify({'success': False, 'error': 'old_text not found'}), 400
        content = content.replace(old_text, new_text)
        with open(path, 'w') as f:
            f.write(content)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/delete', methods=['DELETE'])
def delete_file():
    path = request.args.get('path')
    if not path:
        return jsonify({'success': False, 'error': 'Path required'}), 400
    try:
        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)
