from flask import request, url_for, render_template, g, session, redirect, \
        flash
from flask.ext.login import login_required, login_user, logout_user, \
        current_user
from . import app, db, lm, forms
from .models import User

@lm.user_loader
def load_user(userid):
    try:
        return User.query.get(int(userid))
    except (TypeError, ValueError):
        pass

@app.before_request
def before_request():
    # so that we can access the current user wherever
    g.user = current_user

@app.route('/')
def index():
    if g.user is None or not g.user.is_authenticated():
        return redirect(url_for("login"))

    return render_template("index.html",
            title="index")

@app.route('/login', methods=["GET", "POST"])
def login():
    if g.user is not None and g.user.is_authenticated():
        return redirect(url_for("index"))

    form = forms.Login()

    if form.validate_on_submit():
        login_user(form.user)
        return redirect(url_for("index"))

    return render_template("login.html",
            title="Log in",
            form=form)

@app.route("/register", methods=["GET", "POST"])
def register():
    if g.user is not None and g.user.is_authenticated():
        return redirect(url_for("index"))

    form = forms.Register()

    if form.validate_on_submit():
        user = User(email=form.email.data,
                    password=form.password.data)

        db.session.add(user)
        db.session.commit()

        flash("Registered!")

        login_user(user)
        return redirect(url_for("index"))

    return render_template("register.html",
            title="register in",
            form=form)

@app.route("/logout")
def logout():
    logout_user()
    flash("You were logged out")
    return redirect(url_for("index"))
