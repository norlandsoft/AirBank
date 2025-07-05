import {error} from "@/components/Notification";

const codeMessage = {
  200: '服务器成功返回请求的数据。',
  400: '发出的请求有错误，服务器无法解析参数数据。',
  401: '用户没有权限（令牌、用户名、密码错误），或登录超时。',
  403: '用户得到授权，但是访问是被禁止的。',
  404: '发出的请求针对的是不存在的记录，服务器没有进行操作。',
  406: '请求的格式不可得。',
  410: '请求的资源被永久删除，且不会再得到的。',
  415: 'Unsupported Media Type',
  422: '当创建一个对象时，发生一个验证错误。',
  500: '应用服务产生错误，请检查服务日志。',
  501: '无法处理服务请求。',
  502: '网关错误。',
  503: '服务不可用，服务器暂时过载或维护。',
  504: '网关超时。',
};

// 封装请求头
function requestHeader() {
  const token = sessionStorage.getItem("air-auth-token");
  return {
    'Authorization': 'Bearer ' + token,
    'Connection': 'keep-alive',
    'Content-Type': 'application/json;charset=UTF-8',
  };
}

// 判断是否为JSON格式字符串
export function isJSON(str: any) {
  if (typeof str === 'string') {
    try {
      const obj = JSON.parse(str);
      return !!(typeof obj === 'object' && obj);
    } catch (e) {
      return false;
    }
  } else {
    return true;
  }
}

export async function POST(url: string | URL | Request, params: any) {
  return new Promise(
    (resolve, reject) => {
      fetch(url, {
        method: 'POST',
        headers: requestHeader(),
        mode: 'cors',
        cache: "no-cache",
        body: isJSON(params) ? JSON.stringify(params) : params
      }).then((res) => {
        switch (res.status) {
          case 400:
            return resolve({
              success: false,
              code: 'HTTP-400',
              message: '异常 [HTTP-400], 请求参数错误'
            });
          case 401:
            return resolve({
              success: false,
              code: 'HTTP-401',
              message: '异常 [HTTP-401], 用户未登录'
            });
          case 404:
            return resolve({
              success: false,
              code: 'HTTP-404',
              message: '异常 [HTTP-404], 请求地址不存在'
            });
          case 408:
            return resolve({
              success: false,
              code: 'HTTP-408',
              message: '异常 [HTTP-408], 请求超时'
            });
          case 500:
            return resolve({
              success: false,
              code: 'HTTP-500',
              message: '异常 [HTTP-500], 服务端无法处理当前请求'
            });
          case 501:
            return resolve({
              success: false,
              code: 'HTTP-501',
              message: '异常 [HTTP-501], 服务端无法处理当前请求'
            });
          case 502:
          case 503:
          case 504:
            return resolve({
              success: false,
              code: `HTTP-${res.status}`,
              message: '无法访问服务, 请检查服务是否正常运行，或联系平台管理员。'
            });
          case 200:
            // 判断返回数据raw是否为空
            if (res.headers.get('Content-Length') === '0') {
              return resolve({
                success: false,
                message: '服务端无法处理当前请求, 请检查服务是否正常运行，或联系平台管理员查看系统日志。'
              });
            }

            // 判断返回数据是否为JSON格式
            if (res.headers.get('Content-Type')?.indexOf('application/json') !== -1) {
              // 另一种写法：return resolve(res.json());
              return res.json().then(resolve);
            } else if (res.headers.get('Content-Type')?.indexOf('application/octet-stream') !== -1) {
              // 处理文件下载
              return res.blob().then(blob => {
                // const filename = res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'download';
                const contentDisposition = res.headers.get('Content-Disposition') || '';
                const filename = decodeFilename(contentDisposition);
                const url = window.URL.createObjectURL(blob);
                const temp_a_tag_for_download = document.createElement('a');
                temp_a_tag_for_download.style.display = 'none';
                temp_a_tag_for_download.href = url;
                temp_a_tag_for_download.download = filename;
                document.body.appendChild(temp_a_tag_for_download);
                temp_a_tag_for_download.click();
                window.URL.revokeObjectURL(url);
                // 删除标签
                document.body.removeChild(temp_a_tag_for_download);
                return resolve({ success: true, message: '文件下载成功' });
              }).catch(reject);
            } else {
              // 非json格式, 返回blob
              return resolve(res.blob());
            }
          default:
            error({
              title: `HTTP ${res.status}`,
              message: codeMessage[res.status]
            });
        }
      }).catch(err => {
        error({
          title: '网络错误',
          message: err.message
        });
      });
    }
  );
}

function decodeFilename(contentDisposition: string): string {
  let filename = 'download';

  // 尝试解析 filename*= 参数（RFC 5987）
  const filenameRegex = /filename\*=(?:utf-8|UTF-8)''([\w%.-]+)/i;
  let matches = filenameRegex.exec(contentDisposition);
  if (matches != null && matches[1]) {
    try {
      return decodeURIComponent(matches[1].replace(/\+/g, '%20'));
    } catch (e) {
      console.error('解码文件名失败', e);
    }
  }

  // 尝试解析普通的 filename= 参数
  const fallbackRegex = /filename="?(.+?)"?(?:;|$)/i;
  matches = fallbackRegex.exec(contentDisposition);
  if (matches != null && matches[1]) {
    filename = matches[1].replace(/['"]/g, '');
    try {
      // 尝试 URL 解码
      return decodeURIComponent(filename);
    } catch (e) {
      // 如果 URL 解码失败，可能是因为文件名已经是 UTF-8 编码的字符串
      try {
        // 尝试将 ISO-8859-1 编码的字符串转换为 UTF-8
        return decodeURIComponent(escape(filename));
      } catch (e2) {
        console.error('解码文件名失败', e2);
        // 如果所有尝试都失败，返回原始文件名
        return filename;
      }
    }
  }

  return filename;
}