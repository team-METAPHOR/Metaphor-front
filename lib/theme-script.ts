// 서버 레이아웃(app/layout.tsx)이 문자열로 읽어야 하므로 "use client" 모듈과 분리한다.

export const THEME_STORAGE_KEY = "spear-theme";

/**
 * 저장된 테마를 첫 화면을 그리기 전에 <html data-theme>에 적용한다.
 * 저장값이 없으면 다크, "system"이면 OS 설정을 따른다.
 */
export const themeScript = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var t=p==="light"||p==="dark"?p:p==="system"&&matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
