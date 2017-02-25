# weroll
### 极速搭建一个基于微服务架构的Node.js应用程序
weroll基于MongoDB，Redis，Express 4.x以及PureHttp（基于原生http库开发的极简化API服务库），经过数个商业项目凝练而来。<br>
主要特点如下：
* 合理的项目文件结构，区分路由逻辑和API逻辑
* 路由和API可定义访问权限
* API定义支持常用的数据校验（如字符，数字，手机号等），支持必须参数和可选参数设定
* 提供API调试工具，自动显示API描述和参数说明
* 支持多环境配置, 可根据启动参数切换运行环境, 如dev, test, production等, 不同的环境使用不同的配置文件，由开发者自由定义
* 使用Mongoose操作数据库，简化了Schema定义流程，简化了Model使用方式
* 封装了socket.io实现websocket服务
* 集成一些常见的web服务功能，如用户权限维护，邮件发送，短信发送/验证码检查等
* 面向微服务架构，多个weroll应用之间可以配置成为一个生态系统，相互之间可以调用API和推送消息


一个最精简的weroll应用程序骨架如下：
<pre>
<code>
+ 项目目录
    <i>+ node_modules
        + weroll</i>
    + client --------------- web前端
        + res ---------------- 静态资源目录
            + js
            + css
    + views ----------------- html页面
        + template --------------- nunjucks模板
    + server --------------- 数据&逻辑&服务
        + config ----------------- 环境配置文件
            + localdev --------------- 本地开发环境的配置
                cache.config ------------ 缓存配置
                setting.js ----------- 全局配置
            + test
            + prod
        + router ----------------- 页面路由
        + service ------------------- API接口
    main.js ------------------ 入口
    package.json
</code>
</pre>
