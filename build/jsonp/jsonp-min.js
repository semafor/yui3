YUI.add("jsonp-base",function(C){var B=C.Lang.isFunction;function A(){this._init.apply(this,arguments);}A.prototype={_init:function(D,F){this.url=D;F=(B(F))?{on:{success:F}}:F||{};var E=F.on||{};if(!E.success){E.success=this._defaultCallback(D,F);}this._config=C.merge({context:this,args:[],format:this._format},F,{on:E});},_defaultCallback:function(){},send:function(){var F=C.guid(),E=this._config,D=E.format.call(this,this.url,"YUI.Env.JSONP."+F);if(!E.on.success){return this;}function G(H){return(B(H))?function(I){delete YUI.Env.JSONP[F];H.apply(E.context,[I].concat(E.args));}:null;}YUI.Env.JSONP[F]=G(E.on.success);C.Get.script(D,{onFailure:G(E.on.failure),onTimeout:G(E.on.timeout),timeout:E.timeout});return this;},_format:function(D,E){return D.replace(/\{callback\}/,E);}};C.JSONPRequest=A;C.jsonp=function(D,E){return new C.JSONPRequest(D,E).send();};if(!YUI.Env.JSONP){YUI.Env.JSONP={};}},"@VERSION@",{requires:["get","oop"]});YUI.add("jsonp-url",function(E){var B=E.JSONPRequest,D=E.Object.getValue,C=function(){},F=".",A="@";E.mix(B.prototype,{_pattern:/\bcallback=(.*?)(?=&|$)/i,_template:"callback={callback}",_defaultCallback:function(I){var H=I.match(this._pattern),G={},J=0,K,L;if(H){K=H[1].replace(/\[(?:(['"])([^\]\1]+)\1|(\d+))\]/g,function(P,N,O,M){var R=(RegExp.rightContext||".").charAt(0),Q=A+(++J);G[Q]=O||M;if(R!==F&&R!=="["){Q+=F;}return F+Q;}).split(/\./);E.each(K,function(N,M){if(N.charAt(0)==="@"){K[M]=G[N];}});L=D(E.config.win,K)||D(E,K)||D(E,K.slice(1));}return L||C;},_format:function(G,I){var J=this._template.replace(/\{callback\}/,I),H;if(this._pattern.test(G)){return G.replace(this._pattern,J);}else{H=G.slice(-1);if(H!=="&"&&H!=="?"){G+=(G.indexOf("?")>-1)?"&":"?";}return G+J;}}},true);},"@VERSION@",{requires:["jsonp-base"]});YUI.add("jsonp",function(A){},"@VERSION@",{use:["jsonp-base","jsonp-url"]});