// js/http-util.js
class HttpUtil {

    /**
     * 通过 Android 桥接发送请求
     * @param {string} url - 请求URL
     * @param {Object} options - 请求选项
     * @returns {Promise}
     */
    static async request(url, options = {}) {
        // 默认配置
        const defaultOptions = {
            method: 'GET',
            headers: {},
            body: null,
            timeout: 15000,
            responseType: 'json' // 'json', 'text', 'blob'
        };

        // 合并配置
        const config = { ...defaultOptions, ...options };

        // 准备请求数据
        const headers = config.headers;
        let body = config.body;

        // 自动设置 Content-Type
        if (body && !headers['Content-Type']) {
            if (typeof body === 'object') {
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify(body);
            } else if (typeof body === 'string') {
                headers['Content-Type'] = 'text/plain';
            }
        }

        try {
            // 检查桥接是否存在
            if (typeof JSBridge === 'undefined') {
                throw new Error('JSBridge is not available');
            }

            // 调用原生桥接
            const responseStr = await new Promise((resolve, reject) => {
                try {
                    const result = JSBridge.httpRequest(
                        url,
                        config.method,
                        JSON.stringify(headers),
                        body
                    );
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });

            // 解析响应
            const response = JSON.parse(responseStr);

            // 检查错误
            if (response.error) {
                throw new Error(response.message || 'Request failed');
            }

            // 构建类似 fetch 的响应对象
            const responseObj = {
                ok: response.status >= 200 && response.status < 300,
                status: response.status,
                statusText: response.statusText || '',
                headers: this._parseHeaders(response.headers),
                url: url,
                type: 'default'
            };

            // 根据 responseType 处理响应体
            let data = response.body;
            if (config.responseType === 'json') {
                try {
                    data = JSON.parse(response.body);
                } catch (e) {
                    // 保持原始字符串
                }
            }

            return {
                ...responseObj,
                data: data,
                json: async () => JSON.parse(response.body),
                text: async () => response.body,
                blob: async () => new Blob([response.body])
            };

        } catch (error) {
            console.error('Request failed:', error);
            throw error;
        }
    }

    /**
     * 解析响应头
     * @private
     */
    static _parseHeaders(headersObj) {
        const headers = new Map();
        for (const key in headersObj) {
            if (headersObj.hasOwnProperty(key)) {
                headers.set(key.toLowerCase(), headersObj[key][0]);
            }
        }
        return {
            get: (name) => headers.get(name.toLowerCase()),
            has: (name) => headers.has(name.toLowerCase())
        };
    }

    /**
     * GET 请求
     */
    static async get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }

    /**
     * POST 请求
     */
    static async post(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'POST',
            body: data
        });
    }

    /**
     * PUT 请求
     */
    static async put(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'PUT',
            body: data
        });
    }

    /**
     * DELETE 请求
     */
    static async delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    }
}