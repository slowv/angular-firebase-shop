import {Injectable, NgZone} from '@angular/core';
import {
  AngularFirestore,
  AngularFirestoreCollection,
  AngularFirestoreDocument,
  QueryDocumentSnapshot,
  QuerySnapshot
} from '@angular/fire/firestore';
import {AngularFireAuth} from '@angular/fire/auth';
import {Router} from '@angular/router';
import {User} from '../model/user';
import {Observable, Subscription} from 'rxjs';
import firebase from 'firebase';
import auth = firebase.auth;
import UserCredential = firebase.auth.UserCredential;
import {LocalStorageUtil} from '../utils/LocalStorageUtil';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  userData: User;
  useRef: AngularFirestoreCollection;
  private path = '/users';

  constructor(
    public afs: AngularFirestore,   // Inject Firestore service
    public afAuth: AngularFireAuth, // Inject Firebase auth service
    public router: Router,
    public ngZone: NgZone // NgZone service to remove outside scope warning
  ) {
    this.useRef = afs.collection(this.path);
    /* Saving user data in localstorage when
    logged in and setting up null when logged out */
    this.afAuth.authState.subscribe((user) => {
      if (user) {
        this.afs.collection<User>(this.path, ref => ref.where('uid', '==', user.uid))
          .get()
          .toPromise()
          .then((value: QuerySnapshot<User>) => {
            value.forEach((result: QueryDocumentSnapshot<User>) => {
              this.userData = result.data();
              this.userData.role = [];
              this.findUserById(this.userData.uid).subscribe(userResult => {
                LocalStorageUtil.setData<User>('user', userResult);
              });
            });
          });
      } else {
        localStorage.setItem('user', null);
      }
    });
  }

  // Sign in with email/password
  signIn(email, password): Promise<void> {
    return this.afAuth.signInWithEmailAndPassword(email, password)
      .then((result: UserCredential) => {
        this.ngZone.run(() => {
          this.router.navigate(['admin/welcome']).then();
        });
        localStorage.setItem('user', JSON.stringify(result.user));
        this.getUSerData(result.user.uid);
      }).catch((error) => {
        console.error(error.message);
      });
  }

  // Sign up with email/password
  signUp(user: User, password): Promise<void> {
    return this.afAuth.createUserWithEmailAndPassword(user.email, password)
      .then((result: UserCredential) => {
        user.uid = result.user.uid;
        this.sendVerificationMail();
        this.setUserData(user).then();
        console.log('UPDATE user', user);
      }).catch((error) => {
        console.log(error.message);
      });
  }

  // Send email verification when new user sign up
  sendVerificationMail(): Subscription {
    return this.afAuth.user.subscribe((user) => {
      user.sendEmailVerification().then(() => {
        this.router.navigate(['admin/auth', 'verify-email']).then();
      });
    });
  }

  // Reset Forgot password
  forgotPassword(passwordResetEmail): Promise<void> {
    return this.afAuth.sendPasswordResetEmail(passwordResetEmail)
      .then(() => {
        console.log('Password reset email sent, check your inbox.');
      }).catch((error) => {
        console.log(error);
      });
  }

  // Returns true when user is logged in and email is verified
  get isLoggedIn(): boolean {
    const user = LocalStorageUtil.getData<User>('user');
    return user !== null && user.emailVerified !== false;
  }

  setUserData(user): Promise<any> {
    const userRef: AngularFirestoreDocument<any> = this.afs.doc<User>('users');
    const userData: User = this.buildUser(user);
    return userRef.set(userData, {
      merge: true
    });
  }

  buildUser(user): User {
    console.log(user);
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      photoURL: user.photoURL || null,
      emailVerified: user.emailVerified,
      role: user.role || ['CUSTOMER'],
      phoneNumber: user.phoneNumber || null
    } as User;
  }

  getUSerData(uid: string): any {
    return this.useRef.doc(uid).valueChanges({
      idField: 'uid'
    });
  }

  // Sign in with Google
  GoogleAuth(): Promise<void> {
    return this.AuthLogin(new auth.GoogleAuthProvider());
  }

  FacebookAuth(): Promise<void> {
    return this.AuthLogin(new auth.FacebookAuthProvider());
  }

  TwitterAuth(): Promise<void> {
    return this.AuthLogin(new auth.TwitterAuthProvider());
  }

  GitHubAuth(): Promise<void> {
    return this.AuthLogin(new auth.GithubAuthProvider());
  }

  // Auth logic to run auth providers
  AuthLogin(provider): Promise<void> {
    return this.afAuth.signInWithPopup(provider)
      .then((result: UserCredential) => {
        this.ngZone.run(() => {
          this.router.navigate(['admin/welcome']).then();
        });
        const u = this.buildUser(result.user);
        this.setUserData(u).then();
      }).catch((error) => {
        console.log(error);
      });
  }

  // Sign out
  signOut(): Promise<void> {
    return this.afAuth.signOut().then(() => {
      localStorage.removeItem('user');
      this.router.navigate(['admin/auth']).then();
    });
  }

  findUserById(id: string): Observable<User> {
    return this.useRef.doc<User>(id).valueChanges({
      idField: 'uid'
    });
  }
}
