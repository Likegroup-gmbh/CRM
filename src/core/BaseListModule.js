import App from './App.js';

export class BaseListModule {
  get supabase()        { return App.get('supabase'); }
  get currentUser()     { return App.get('currentUser'); }
  get navigateTo()      { return App.get('navigateTo'); }
  get setHeadline()     { return App.get('setHeadline'); }
  get breadcrumbs()     { return App.get('breadcrumbSystem'); }
  get content()         { return App.get('content'); }
  get errorHandler()    { return App.get('ErrorHandler'); }
  get toast()           { return App.get('toastSystem'); }
  get permissions()     { return App.get('permissionSystem'); }
  get dataService()     { return App.get('dataService'); }
  get moduleRegistry()  { return App.get('moduleRegistry'); }

  get isCurrent() {
    return this.moduleRegistry?.currentModule === this;
  }
}
