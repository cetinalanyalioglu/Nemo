from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Example API endpoint
@app.route('/api/elements', methods=['GET'])
def get_elements():
    elements = {
        "MassFlowInlet": {
            "ports": [
                { "index": 0, "type": "outgoing" }
            ]
        },
        "PressureOutlet": {
            "ports": [
                { "index": 0, "type": "incoming" }
            ]
        },
        "LosslessDuct": {
            "ports": [
                { "index": 0, "type": "incoming" },
                { "index": 1, "type": "outgoing" }
            ]
        },
        "SuddenExpansion": {
            "ports": [
                { "index": 0, "type": "incoming" },
                { "index": 1, "type": "outgoing" }
            ]
        },
        "PressureJunction": {
            "ports": [
                { "index": 0, "type": "both" },
                { "index": 1, "type": "both" },
                { "index": 2, "type": "both" }
            ]
        }
    }
    return jsonify(elements)

if __name__ == '__main__':
    app.run(port=5000) 